var expect = require('expect')
var User = require('./user');

describe('creating user', () => {
  it('creates user with socket field and undefined name', () => {
    let user = new User('socket');
    expect(user.socket).toBe('socket');
    expect(user.name).toBe(undefined);
  });
});

describe('setName', () => {
  it('sets user.name to name', () => {
    let user = new User('socket');
    expect(user.name).toBe(undefined);
    user.setName('name');
    expect(user.name).toBe('name');
    
  })
});
