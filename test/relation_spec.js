'use strict';

describe('Restmod model relation:', function() {

  var $httpBackend, $restmod, $injector, Bike;

  beforeEach(module('plRestmod'));

  // generate a dummy module
  beforeEach(module(function($provide) {
    $provide.factory('Part', function($restmod) {
      return $restmod.model('/api/parts');
    });

    $provide.factory('BikeRide', function($restmod) {
      return $restmod.model(null);
    });

    $provide.factory('User', function($restmod) {
      return $restmod.model('/api/users');
    });

    $provide.factory('SerialNo', function($restmod) {
      return $restmod.model(null);
    });
  }));

  // cache entities to be used in tests
  beforeEach(inject(['$injector', function(_$injector) {
    $injector = _$injector;
    $httpBackend = $injector.get('$httpBackend');
    $restmod = $injector.get('$restmod');
  }]));

  describe('hasMany', function() {

    beforeEach(function() {
      Bike = $restmod.model('/api/bikes', {
        allParts: { hasMany: 'Part' },
        activity: { hasMany: 'BikeRide', path: 'rides', inverseOf: 'bike' }
      });
    });

    it('should use the parameterized attribute name if no url is provided', function() {
      expect(Bike.$new(1).allParts.$url()).toEqual('/api/bikes/1/all-parts');
    });

    it('should use url provided in path option', function() {
      expect(Bike.$new(1).activity.$url()).toEqual('/api/bikes/1/rides');
    });

    it('should set the inverse property of each child if required', function() {
      var bike = Bike.$new(1).$decode({ rides: [{ id: 1 }, { id: 2 }] });
      expect(bike.activity[0].bike).toEqual(bike);
      expect(bike.activity[1].bike).toEqual(bike);
    });

    it('should use nested url only for create if resource is not anonynous', function() {
      var part = Bike.$new(1).allParts.$buildRaw({ id: 'HW101' });

      part.$fetch();
      part.$save();

      $httpBackend.when('GET', '/api/parts/HW101').respond(200, '{}');
      $httpBackend.when('PUT', '/api/parts/HW101').respond(200, '{}');
      $httpBackend.flush();
    });

    it('should use nested url if resource anonymous', function() {
      var ride = Bike.$new(1).activity.$buildRaw({ id: 20 });

      ride.$fetch();
      ride.$save();

      $httpBackend.when('GET', '/api/bikes/1/rides/20').respond(200, '{}');
      $httpBackend.when('PUT', '/api/bikes/1/rides/20').respond(200, '{}');
      $httpBackend.flush();
    });

    it('should load inline content into relation if available and use path as source', function() {
      var bike = Bike.$new(1).$decode({ rides: [{ id: 1 }, { id: 2 }] });
      expect(bike.activity.length).toEqual(2);
    });

    it('should reset collection content if new inline content is fed', function() {
      var bike = Bike.$new(1).$decode({ rides: [{ id: 1 }, { id: 2 }] });
      bike.$decode({ rides: [{ id: 3 }] });
      expect(bike.activity.length).toEqual(1);
    });

    it('should bubble child events to child type', function() {
      var spy = jasmine.createSpy();
      $injector.get('BikeRide').$on('after-init', spy);
      Bike.$new(1).$decode({ rides: [{ id: 1 }] });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('hasOne', function() {

    beforeEach(function() {
      Bike = $restmod.model('/api/bikes', {
        owner: { hasOne: 'User' },
        activity: { hasMany: 'BikeRide' },
        serialNo: { hasOne: 'SerialNo', path: 'serial', inverseOf: 'bike' }
      });
    });

    it('should use parameterized attribute name if no path option is provided', function() {
      expect(Bike.$new(1).activity.$url()).toEqual('/api/bikes/1/activity');
    });

    it('should use url provided in path option', function() {
      expect(Bike.$new(1).serialNo.$url()).toEqual('/api/bikes/1/serial');
    });

    it('should generate a child resource that uses the canonical url if not anonymous', function() {
      var bike = Bike.$new(1).$decode({ owner: { id: 'XX' } });
      expect(bike.owner.$url()).toEqual('/api/users/XX');
    });

    it('should not use nested url for update/delete if child resource is not anonymous', function() {
      var bike = Bike.$new(1).$decode({ owner: { id: 'XX' } });

      bike.owner.$fetch();
      bike.owner.$save();
      bike.owner.$destroy();

      $httpBackend.expectGET('/api/bikes/1/owner').respond(200, '{}'); // nested
      $httpBackend.expectPUT('/api/users/XX').respond(200, '{}'); // not nested
      $httpBackend.expectDELETE('/api/users/XX').respond(200, '{}'); // not nested
      $httpBackend.flush();
    });

    it('should generate a child resource that uses the nested url if anonymous', function() {
      var bike = Bike.$new(1).$decode({ serial: { id: 'XX' } });
      expect(bike.serialNo.$url()).toEqual('/api/bikes/1/serial');
    });

    it('should use nested url if resource anonymous', function() {
      var bike = Bike.$new(1).$decode({ serial: { id: 'XX' } });

      bike.serialNo.$fetch();
      bike.serialNo.$save();
      bike.serialNo.$destroy();

      $httpBackend.expectGET('/api/bikes/1/serial').respond(200, '{}');
      $httpBackend.when('PUT', '/api/bikes/1/serial').respond(200, '{}');
      $httpBackend.when('DELETE', '/api/bikes/1/serial').respond(200, '{}');
      $httpBackend.flush();
    });

    it('should not be able to destroy when resource is anonymous', function() {
      expect(function() {
        Bike.$new(1).owner.$destroy();
      }).toThrow();
    });

    it('should load inline content into relation if available and use path as source', function() {
      var bike = Bike.$new(1).$decode({ serial: { value: 'SERIAL' } });
      expect(bike.serialNo.value).toEqual('SERIAL');
    });

    it('should bubble child events to child type', function() {
      var spy = jasmine.createSpy();
      $injector.get('SerialNo').$on('after-init', spy);
      Bike.$new(1).$decode({ serial: { value: 'SERIAL' } });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('referenceTo', function() {

    beforeEach(function() {
      Bike = $restmod.model('/api/bikes', {
        frame: { belongsTo: 'Part' },
        user: { belongsTo: 'User', key: 'ownerId' }
      });
    });

    it('should load resource after fetching id', function() {
      var bike = Bike.$new(1);
      expect(bike.frame).toBeNull();
      bike.$decode({ frameId: 'XX' });
      expect(bike.frame.$pk).toEqual('XX');
    });

    it('should load resource using id specified in key', function() {
      var bike = Bike.$new(1);
      bike.$decode({ ownerId: 'XX' });
      expect(bike.user.$pk).toEqual('XX');
    });

    it('should behave as an independent resource', function() {
      var bike = Bike.$new(1).$decode({ frameId: 'XX' });
      expect(bike.frame.$url()).toEqual('/api/parts/XX');
    });

    it('should reload resource only if id changes', function() {
      var bike = Bike.$new(1).$decode({ frameId: 'XX' }),
          original = bike.frame;

      bike.$decode({ frameId: 'XX' });
      expect(bike.frame).toEqual(original);

      bike.$decode({ frameId: 'XY' });
      expect(bike.frame).not.toEqual(original);
    });
  });

  describe('belongsTo inline', function() {

    beforeEach(function() {
      Bike = $restmod.model('/api/bikes', {
        frame: { belongsTo: 'Part', inline: true },
        user: { belongsTo: 'User', inline: true, source: 'owner' }
      });
    });

    it('should load resource after fetching id', function() {
      var bike = Bike.$new(1);
      expect(bike.frame).toBeNull();
      bike.$decode({ frame: { name: 'XX' } });
      expect(bike.frame.name).toEqual('XX');
    });

    it('should load resource from property specified in source', function() {
      var bike = Bike.$build({ id: 1 }).$decode({ owner: { name: 'XX' } });
      expect(bike.user.name).toEqual('XX');
    });

    it('should behave as an independent resource', function() {
      var bike = Bike.$build({ id: 1 }).$decode({ frame: { id: 'XX' } });
      expect(bike.frame.$url()).toEqual('/api/parts/XX');
    });

    it('should reload resource only if id changes', function() {
      var bike = Bike.$build({ id: 1 }).$decode({ frame: { id: 'XX' } }),
          original = bike.frame;

      bike.$decode({ frame: { id: 'XX' } });
      expect(bike.frame).toEqual(original);

      bike.$decode({ frame: { id: 'XY' } });
      expect(bike.frame).not.toEqual(original);
    });
  });

});

