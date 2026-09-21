import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../app';
import { OrganizationModel } from '../models/Organization.model';
import { UserModel } from '../models/User.model';
import { MembershipModel } from '../models/Membership.model';

async function run() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { directConnection: true });

  try {
    await Promise.all([OrganizationModel.init(), UserModel.init(), MembershipModel.init()]);
    const app = createApp();
    const agent = request.agent(app);
    const registration = await agent
      .post('/api/v1/auth/register')
      .send({
        name: 'Revocation Test',
        email: 'revocation@test.local',
        password: 'password123',
        organizationName: 'Revocation Org',
        businessType: 'general',
      })
      .expect(201);

    await agent.get('/api/v1/auth/me').expect(200);

    await MembershipModel.updateOne(
      { userId: registration.body.data.user._id, organizationId: registration.body.data.organization._id },
      { status: 'disabled' }
    );
    const revoked = await agent.get('/api/v1/auth/me').expect(401);
    assert.equal(revoked.body.error.code, 'SESSION_REVOKED');
    console.log('✅ Membership revocation invalidates an existing token immediately');
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
