import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import '../core/tenancy/tenant.middleware';
import { register, login } from '../modules/auth/auth.controller';
import { createOrganization, switchOrganization } from '../modules/organizations/organization.controller';
import { listCustomers } from '../modules/customers/customer.controller';
import { createRecurringProfile, updateRecurringProfile } from '../modules/recurring/recurring.controller';
import { UserModel } from '../models/User.model';
import { MembershipModel } from '../models/Membership.model';
import { OrganizationModel } from '../models/Organization.model';
import { CustomerModel } from '../models/Customer.model';
import { RecurringProfileModel } from '../models/RecurringProfile.model';

let mongo: MongoMemoryServer;

function mockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.data = data;
    return res;
  };
  return res;
}

const noop = () => {};

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    failed += 1;
    console.error(`❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function run() {
  console.log('🚀 RUNNING SAAS MULTI-TENANCY FLOW TESTS...');
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { directConnection: true });

  await UserModel.init();
  await MembershipModel.init();
  await OrganizationModel.init();
  await CustomerModel.init();
  await RecurringProfileModel.init();

  try {
    // 1. Register creates organization + user + admin membership
    let res = mockRes();
    await register(
      { body: { name: 'Ada Retail', email: 'ada@retail.test', password: 'password123', organizationName: 'Ada Retail', businessType: 'retail' } } as any,
      res,
      noop
    );
    check('Register returns 201', res.statusCode === 201);
    const orgAId = res.data?.data?.organization?._id;
    const userAId = String(res.data?.data?.user?._id);
    check('Register returns organization', Boolean(orgAId));
    check('Register returns memberships', Array.isArray(res.data?.data?.memberships) && res.data.data.memberships.length === 1);
    check('Retail org gets POS module', (res.data?.data?.organization?.enabledModules || []).includes('pos'));

    const membershipCount = await MembershipModel.countDocuments({ userId: userAId });
    check('Admin membership created', membershipCount === 1);

    // 2. Deterministic login
    res = mockRes();
    await login({ body: { email: 'ada@retail.test', password: 'password123' } } as any, res, noop);
    check('Login succeeds', res.statusCode === 200 && res.data?.success === true);
    check('Login returns memberships', (res.data?.data?.memberships || []).length === 1);

    // 3. Duplicate email is rejected (global unique)
    res = mockRes();
    await register(
      { body: { name: 'Other', email: 'ada@retail.test', password: 'password123', organizationName: 'Other Org', businessType: 'saas' } } as any,
      res,
      noop
    );
    check('Duplicate email rejected with 409', res.statusCode === 409);

    // 4. Wrong password rejected deterministically
    res = mockRes();
    await login({ body: { email: 'ada@retail.test', password: 'wrong-password' } } as any, res, noop);
    check('Wrong password rejected with 401', res.statusCode === 401);

    // 5. User creates a second organization and becomes admin
    res = mockRes();
    await createOrganization(
      { tenant: { userId: userAId, organizationId: String(orgAId), role: 'admin', email: 'ada@retail.test' }, body: { name: 'Ada SaaS', businessType: 'saas', enabledModules: ['subscriptions', 'invoices', 'customers'] } } as any,
      res,
      noop
    );
    check('Create organization returns 201', res.statusCode === 201);
    const orgBId = res.data?.data?.organization?._id;
    check('Create organization returns memberships (2)', (res.data?.data?.memberships || []).length === 2);
    check('Create organization returns its active membership', Boolean(res.data?.data?.membershipId));

    // 6. Switch to a member organization succeeds
    res = mockRes();
    await switchOrganization({ tenant: { userId: userAId, email: 'ada@retail.test' }, body: { organizationId: String(orgAId) } } as any, res, noop);
    check('Switch to member organization succeeds', res.statusCode === 200 && String(res.data?.data?.organization?._id) === String(orgAId));

    // 7. Switch to a non-member organization is rejected by the backend
    res = mockRes();
    await switchOrganization({ tenant: { userId: userAId, email: 'ada@retail.test' }, body: { organizationId: String(new mongoose.Types.ObjectId()) } } as any, res, noop);
    check('Switch to non-member organization rejected with 403', res.statusCode === 403);

    // 8. Tenant query isolation for customers
    await CustomerModel.create({ organizationId: orgAId, name: 'Alpha Customer', email: 'alpha@retail.test' });
    res = mockRes();
    await listCustomers({ tenant: { organizationId: String(orgAId) }, query: {} } as any, res, noop);
    check('Org A sees its own customer', (res.data?.data || []).length === 1);

    res = mockRes();
    await listCustomers({ tenant: { organizationId: String(orgBId) }, query: {} } as any, res, noop);
    check('Org B cannot see Org A customer', (res.data?.data || []).length === 0);

    // 9. Recurring annual cadence normalization (yearly -> annual) and pause
    const customer = await CustomerModel.findOne({ organizationId: orgAId });
    res = mockRes();
    await createRecurringProfile(
      {
        tenant: { organizationId: String(orgAId), userId: userAId, email: 'ada@retail.test', role: 'admin' },
        body: { customerId: String(customer!._id), profileName: 'Annual Plan', frequency: 'yearly', items: [{ description: 'Plan', unit: 'year', quantity: 1, unitPrice: 1000, taxRate: 0 }] },
      } as any,
      res,
      noop
    );
    check('Recurring profile created with yearly alias', res.statusCode === 201);
    const profile = await RecurringProfileModel.findById(res.data?.data?._id);
    check('Yearly frequency stored as annual', profile?.frequency === 'annual');

    res = mockRes();
    await updateRecurringProfile(
      { tenant: { organizationId: String(orgAId) }, params: { id: String(profile!._id) }, body: { status: 'paused' } } as any,
      res,
      noop
    );
    check('Recurring profile paused', res.statusCode === 200 && res.data?.data?.status === 'paused');
  } catch (err) {
    failed += 1;
    console.error('❌ Unexpected test error:', err);
  } finally {
    console.log('\n==================================================');
    console.log(`SAAS FLOW TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('==================================================');
    await mongoose.disconnect();
    await mongo.stop();
    if (failed > 0) process.exit(1);
  }
}

run();
