const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const SECRET = 'test-secret-for-middleware';
process.env.JWT_SECRET = SECRET;

const { authMiddleware } = require('../src/auth');

function mockRes() {
  let code = null;
  const res = {
    status(c) {
      code = c;
      return res;
    },
    json() {
      return res;
    },
    get code() {
      return code;
    },
  };
  return res;
}

test('valid token calls next and sets req.user.id', () => {
  const token = jwt.sign({ id: 42 }, SECRET, { expiresIn: '24h' });
  let called = false;
  const req = { headers: { authorization: 'Bearer ' + token } };
  authMiddleware(req, mockRes(), () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(req.user.id, 42);
});

test('missing authorization header returns 401', () => {
  const res = mockRes();
  authMiddleware({ headers: {} }, res, () => assert.fail('next should not run'));
  assert.equal(res.code, 401);
});

test('invalid token returns 401', () => {
  const res = mockRes();
  authMiddleware({ headers: { authorization: 'Bearer garbage-token' } }, res, () =>
    assert.fail('next should not run')
  );
  assert.equal(res.code, 401);
});

test('expired token returns 401', () => {
  const token = jwt.sign({ id: 1 }, SECRET, { expiresIn: '-1s' });
  const res = mockRes();
  authMiddleware({ headers: { authorization: 'Bearer ' + token } }, res, () =>
    assert.fail('next should not run')
  );
  assert.equal(res.code, 401);
});

test('tampered signature returns 401', () => {
  const token = jwt.sign({ id: 1 }, SECRET, { expiresIn: '24h' });
  const bad = token.slice(0, -3) + 'abc';
  const res = mockRes();
  authMiddleware({ headers: { authorization: 'Bearer ' + bad } }, res, () =>
    assert.fail('next should not run')
  );
  assert.equal(res.code, 401);
});