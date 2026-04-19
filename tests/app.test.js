const request = require('supertest');
const app = require('../app');

describe('API Endpoints', () => {
  test('GET / returns API info', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('CI/CD Demo API');
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /users returns user list', async () => {
    const res = await request(app).get('/users');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /users/:id returns a single user', async () => {
    const res = await request(app).get('/users/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Alice');
  });

  test('GET /users/:id returns 404 for missing user', async () => {
    const res = await request(app).get('/users/999');
    expect(res.statusCode).toBe(404);
  });

  test('POST /users creates a user', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'Charlie', role: 'user' });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Charlie');
  });

  test('POST /users without name returns 400', async () => {
    const res = await request(app).post('/users').send({});
    expect(res.statusCode).toBe(400);
  });
});