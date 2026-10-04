import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../app';
import { productionConfigProblems } from '../config/env';
import { OrganizationModel } from '../models/Organization.model';
import { UserModel } from '../models/User.model';
import { MembershipModel } from '../models/Membership.model';
import { PasswordResetTokenModel } from '../models/PasswordResetToken.model';
import { SupplierModel } from '../models/Supplier.model';
import { ApprovalQueueModel } from '../models/ApprovalQueue.model';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  // 1. Production refuses unsafe configuration
  const strongSecret = 'a'.repeat(16) + 'b'.repeat(16) + 'c'.repeat(16);
  assert.ok(productionConfigProblems({}).length === 3, 'missing secrets are reported');
  assert.ok(productionConfigProblems({ JWT_SECRET: 'deterministic_fallback_secret_for_demo_deployments_only', MONGODB_URI: 'x', CLIENT_URL: 'x' }).length === 1, 'placeholder JWT secret rejected');
  assert.ok(productionConfigProblems({ JWT_SECRET: 'short', MONGODB_URI: 'x', CLIENT_URL: 'x' }).length === 1, 'short JWT secret rejected');
  assert.deepEqual(productionConfigProblems({ JWT_SECRET: strongSecret, MONGODB_URI: 'mongodb+srv://x', CLIENT_URL: 'https://app' }), []);
  console.log('✅ Production config validation rejects missing/weak secrets');

  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { directConnection: true });
  try {
    await Promise.all([OrganizationModel.init(), UserModel.init(), MembershipModel.init(), PasswordResetTokenModel.init()]);
    const app = createApp();

    // 2. Health reports the database
    const health = await request(app).get('/api/v1/health').expect(200);
    assert.equal(health.body.database, 'connected');
    console.log('✅ Health check reports database status');

    // 3. Cross-site state-changing requests are blocked; allowed origins pass
    await request(app).post('/api/v1/auth/logout').set('Origin', 'https://evil.example').expect(403);
    await request(app).post('/api/v1/auth/logout').set('Origin', 'http://localhost:5173').expect(204);
    console.log('✅ Cross-site POST from a foreign origin is rejected');

    // 4. Register a user with a live session
    const agent = request.agent(app);
    await agent
      .post('/api/v1/auth/register')
      .send({ name: 'Reset User', email: 'reset@test.local', password: 'password123', organizationName: 'Reset Org', businessType: 'general' })
      .expect(201);
    await agent.get('/api/v1/auth/me').expect(200);

    // 5. Forgot password answers identically for known and unknown emails
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...a: any[]) => { logs.push(a.join(' ')); };
    const known = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'reset@test.local' }).expect(200);
    const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@test.local' }).expect(200);
    console.log = origLog;
    assert.equal(known.body.data.message, unknown.body.data.message);
    const link = logs.find((l) => l.includes('/reset-password?token='));
    assert.ok(link, 'development reset link is logged');
    const token = link!.split('token=')[1].trim();
    const stored = await PasswordResetTokenModel.findOne({});
    assert.ok(stored && stored.tokenHash !== token, 'only a hash of the token is stored');
    console.log('✅ Forgot-password does not reveal which emails exist; token stored hashed');

    // 6. Reset changes the password, signs out old sessions, and is single-use
    await sleep(1100); // session iat must predate the change (second resolution)
    await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'newpassword456' }).expect(200);
    const revoked = await agent.get('/api/v1/auth/me').expect(401);
    assert.equal(revoked.body.error.code, 'SESSION_REVOKED');
    await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'another12345' }).expect(400);
    await request(app).post('/api/v1/auth/login').send({ email: 'reset@test.local', password: 'password123' }).expect(401);
    await request(app).post('/api/v1/auth/login').send({ email: 'reset@test.local', password: 'newpassword456' }).expect(200);
    console.log('✅ Password reset works once, revokes existing sessions, and old password stops working');

    // 7. Viewer role is read-only across every module
    await agent.post('/api/v1/auth/login').send({ email: 'reset@test.local', password: 'newpassword456' }).expect(200);
    await agent.post('/api/v1/users').send({ name: 'Read Only', email: 'viewer@test.local', password: 'viewerpass1', role: 'viewer' }).expect(201);
    const viewer = request.agent(app);
    await viewer.post('/api/v1/auth/login').send({ email: 'viewer@test.local', password: 'viewerpass1' }).expect(200);
    await viewer.get('/api/v1/customers').expect(200);
    const blocked = await viewer.post('/api/v1/customers').send({ name: 'Should Fail', email: 'x@test.local' }).expect(403);
    assert.equal(blocked.body.error.code, 'READ_ONLY_ROLE');
    const preview = await viewer.post('/api/v1/invoices/preview').send({ items: [{ description: 'x', quantity: 1, unitPrice: 10, taxRate: 0 }] });
    assert.notEqual(preview.status, 403, 'viewer can still use the read-only invoice preview');
    console.log('✅ Viewer role cannot change data but can still read and preview');

    // 8. Update endpoints ignore fields outside their allow-list (no moving records across tenants)
    const me = await agent.get('/api/v1/auth/me').expect(200);
    const ownOrgId = String(me.body.data.organization._id);
    const otherOrgId = String(new mongoose.Types.ObjectId());
    await agent.patch('/api/v1/organizations/settings').send({ enabledModules: ['invoices', 'customers', 'suppliers'] }).expect(200);
    const supplier = await agent.post('/api/v1/suppliers').send({ name: 'Acme Supply' }).expect(201);
    await agent.patch(`/api/v1/suppliers/${supplier.body.data._id}`).send({ name: 'Renamed Supply', organizationId: otherOrgId, outstandingBalance: 999 }).expect(200);
    const storedSupplier = await SupplierModel.findById(supplier.body.data._id).lean();
    assert.equal(String(storedSupplier!.organizationId), ownOrgId, 'organizationId cannot be rewritten');
    assert.equal(storedSupplier!.outstandingBalance || 0, 0, 'balances cannot be set directly');
    assert.equal(storedSupplier!.name, 'Renamed Supply');
    console.log('✅ Updates cannot move records to another tenant or rewrite balances');

    // 9. Settings: invoice counter only moves forward; managers can't restructure the org
    const currentNext = me.body.data.organization.settings.nextInvoiceNumber || 1;
    await agent.patch('/api/v1/organizations/settings').send({ settings: { nextInvoiceNumber: currentNext - 1 } }).expect(400);
    await agent.post('/api/v1/users').send({ name: 'Mgr', email: 'manager@test.local', password: 'managerpass1', role: 'manager' }).expect(201);
    const manager = request.agent(app);
    await manager.post('/api/v1/auth/login').send({ email: 'manager@test.local', password: 'managerpass1' }).expect(200);
    await manager.patch('/api/v1/organizations/settings').send({ enabledModules: ['invoices'] }).expect(403);
    await manager.patch('/api/v1/organizations/settings').send({ name: 'Reset Org Renamed' }).expect(200);
    console.log('✅ Invoice numbering cannot be rewound; only admins change modules');

    // 10. AI inputs are bounded
    const tooLong = await agent.post('/api/v1/ai/ask-business').send({ query: 'x'.repeat(1001) }).expect(400);
    assert.equal(tooLong.body.error.code, 'INPUT_TOO_LONG');
    console.log('✅ Oversized AI prompts are rejected before reaching the provider');

    // 11. Concurrent approvals apply once
    const approval = await ApprovalQueueModel.create({
      organizationId: new mongoose.Types.ObjectId(ownOrgId),
      entityType: 'invoice',
      entityId: new mongoose.Types.ObjectId(),
      requestedBy: new mongoose.Types.ObjectId(),
      requestedByEmail: 'x@test.local',
      reason: 'Large invoice',
    });
    const statuses = (await Promise.all([
      agent.post(`/api/v1/approvals/${approval._id}/approve`).send({}),
      agent.post(`/api/v1/approvals/${approval._id}/approve`).send({}),
    ])).map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    await agent.post(`/api/v1/approvals/${approval._id}/reject`).send({}).expect(409);
    console.log('✅ Double approval and reject-after-approve are refused');

    // 12. Login attempts are throttled per account
    let status = 0;
    for (let i = 0; i < 12; i += 1) {
      status = (await request(app).post('/api/v1/auth/login').send({ email: 'victim@test.local', password: `guess-${i}` })).status;
    }
    assert.equal(status, 429);
    console.log('✅ Repeated login attempts against one account are rate limited');
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
