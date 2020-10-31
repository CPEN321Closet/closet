const config = require('../utils/config');
const mongoose = require('mongoose');
const supertest = require('supertest');
const http = require('http');

const app = require('../app');

describe('clothes', () => {
  let server, api;
  beforeAll(done => {
    server = http.createServer(app);
    server.listen(done);
    api = supertest(server);
  });

  let token, userId;
  it('get token', async () => {
    await api.post('/api/users/signup').send({
      name: 'TESTING',
      email: 'testing@testing.com',
      password: 'TESTING',
    });

    const res = await api.post('/api/users/login').send({
      email: 'testing@testing.com',
      password: 'TESTING',
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body.userId).toBeTruthy();
    expect(res.body.email).toEqual('testing@testing.com');
    expect(res.body.token).toBeTruthy();

    token = res.body.token;
    userId = res.body.userId;
  });

  const clothingOne = {
    category: 't-shirt',
    color: 'blue',
    seasons: ['Summer', 'Fall'],
    occasions: ['home'],
  };

  let oneClothingId;
  it('201 post one clothing', async () => {
    const res = await api
      .post(`/api/clothes/${userId}`)
      .set('Authorization', `Bear ${token}`)
      .send(clothingOne);

    expect(res.statusCode).toEqual(201);

    expect(res.body.seasons).toEqual(clothingOne.seasons);
    expect(res.body.occasions).toEqual(clothingOne.occasions);
    expect(res.body.color).toEqual(clothingOne.color);
    expect(res.body.category).toEqual(clothingOne.category);

    expect(res.body.user).toBeTruthy();
    expect(res.body.id).toBeTruthy();

    oneClothingId = res.body.id;
  });

  it('200 get all clothes should return one clothing for now', async () => {
    const res = await api
      .get(`/api/clothes/${userId}`)
      .set('Authorization', `Bear ${token}`);

    expect(res.statusCode).toEqual(200);

    let resClothes = res.body.clothes;
    expect(Array.isArray(res.body.clothes));
    expect(resClothes.length).toEqual(1);

    expect(resClothes[0].seasons).toEqual(clothingOne.seasons);
    expect(resClothes[0].occasions).toEqual(clothingOne.occasions);
    expect(resClothes[0].color).toEqual(clothingOne.color);
    expect(resClothes[0].category).toEqual(clothingOne.category);
  });

  it('200 get one clothing', async () => {
    const res = await api
      .get(`/api/clothes/${userId}/${oneClothingId}`)
      .set('Authorization', `Bear ${token}`);

    expect(res.statusCode).toEqual(200);

    expect(res.body.seasons).toEqual(clothingOne.seasons);
    expect(res.body.occasions).toEqual(clothingOne.occasions);
    expect(res.body.color).toEqual(clothingOne.color);
    expect(res.body.category).toEqual(clothingOne.category);

    expect(res.body.user).toBeTruthy();
    expect(res.body.id).toBeTruthy();
  });

  it('200 delete one clothing', async () => {
    const res = await api
      .delete(`/api/clothes/${userId}/${oneClothingId}`)
      .set('Authorization', `Bear ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toEqual('Deleted clothing');
  });

  it('404 deleted clothing should not be get', async () => {
    const res = await api
      .get(`/api/clothes/${userId}/${oneClothingId}`)
      .set('Authorization', `Bear ${token}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body.message).toEqual('Not found');
  });

  it('404 delete all clothes should not be found', async () => {
    const res = await api
      .get(`/api/clothes/${userId}`)
      .set('Authorization', `Bear ${token}`);

    expect(res.statusCode).toEqual(404);
    expect(res.statusCode).toEqual(404);
    expect(res.body.message).toEqual('Not found');
  });

  const clothingTwo = {
    category: 'jacket',
    color: 'yellow',
    seasons: ['All'],
    occasions: ['work'],
  };

  it('200 posted multiple clothes should get all clothes', async () => {
    await api
      .post(`/api/clothes/${userId}`)
      .set('Authorization', `Bear ${token}`)
      .send(clothingOne);

    await api
      .post(`/api/clothes/${userId}`)
      .set('Authorization', `Bear ${token}`)
      .send(clothingOne);

    await api
      .post(`/api/clothes/${userId}`)
      .set('Authorization', `Bear ${token}`)
      .send(clothingTwo);

    const res = await api
      .get(`/api/clothes/${userId}`)
      .set('Authorization', `Bear ${token}`);

    expect(res.statusCode).toEqual(200);

    const resClothes = res.body.clothes;
    expect(Array.isArray(resClothes));
    expect(resClothes.length).toEqual(3);

    for (let i = 0; i < 2; i++) {
      expect(resClothes[i].seasons).toEqual(clothingOne.seasons);
      expect(resClothes[i].occasions).toEqual(clothingOne.occasions);
      expect(resClothes[i].color).toEqual(clothingOne.color);
      expect(resClothes[i].category).toEqual(clothingOne.category);
    }

    expect(resClothes[2].seasons).toEqual(clothingTwo.seasons);
    expect(resClothes[2].occasions).toEqual(clothingTwo.occasions);
    expect(resClothes[2].color).toEqual(clothingTwo.color);
    expect(resClothes[2].category).toEqual(clothingTwo.category);
  });

  it('200 get clothes by category', async () => {
    const res = await api
      .get(`/api/clothes/${userId}?category=${clothingOne.category}`)
      .set('Authorization', `Bear ${token}`);

    expect(res.statusCode).toEqual(200);

    const resClothes = res.body.clothes;
    expect(Array.isArray(resClothes));
    expect(resClothes.length).toEqual(2);

    for (let i = 0; i < 2; i++) {
      expect(resClothes[i].seasons).toEqual(clothingOne.seasons);
      expect(resClothes[i].occasions).toEqual(clothingOne.occasions);
      expect(resClothes[i].color).toEqual(clothingOne.color);
      expect(resClothes[i].category).toEqual(clothingOne.category);
    }
  });

  it('404 get clothes by category not found', async () => {
    const res = await api
      .get(`/api/clothes/${userId}?category=NOT_FOUND`)
      .set('Authorization', `Bear ${token}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body.message).toEqual('Not found');
  });

  afterAll(async done => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
    server.close(done);
  });
});
