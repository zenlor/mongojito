// # Mongojito
//
// *a javascript fork of [Mongorito](https://github.com/vdemedes/mongorito)*
// ---
//
// I did like the basic concept but did not like cofeescript, the way a model is defined
// and the impossibility to mass-assign a new model.
//
// I'll add more when I need it for my projects.
// ---

// dependencies
var mongolian = require('mongolian')
  , async = require('async')
  , memcacher = require('memcacher')
  , inflect = require('i')
  , Client = void 0
  , Cache = void 0
  ;

// The main object
var Mongojito = module.exports = {};

// disconnect from the MongoDB server
Mongojito.disconnect = function() {
  if (!!Client) return Client.close();
};

// Connect to MongoDB server
// 
// accepts:
// - an array of server URI
// - a logger Object  
//   the **logger** can have four functions *debug*, *info*, *warn*, *error*
Mongojito.connect = function(servers, logger) {
  if (!servers) servers = [];

  Client = new mongolian(servers[0]);
  if (logger)
    Client.log = {
      debug:  logger['debug'] || function() {},
      info:   logger['info'] || function() {},
      warn:   logger['warn'] || function() {},
      error:  logger['error'] || function() {}
    };
};

Mongojito.Client = Client;

// Memcache connection
Mongojito.cache = function(servers) {
  if (servers == null) servers = [];
  return Cache = new memcacher(servers);
};


// **Mongojito.bake** bakes a new *Model*
// 
// accepts:
// - the collection name
// - an object with validation and hook functions
Mongojito.bake = function(collection, model){
  var f = function(hash){
        MongojitoModel.call(this, collection);
        if (!!hash) {
          for (var key in hash) {
            this[key] = hash[key];
          }
        }
      }
    ;
  f.prototype = new MongojitoModel;
  for (var key in model) {
    f[key] = model[key];
  }
  f.model = f;
  f.find = MongojitoModel.find;
  f.bakeModelsFromItems = MongojitoModel.bakeModelsFromItems;
  f.collectionName = collection;
  return f;
};


// Main Model
MongojitoModel = Mongojito.Model = function() {}


// return all the Model fields
MongojitoModel.prototype.fields = function() {
  var field, fields, notFields;
  notFields = [
    'constructor'
  , 'save'
  , 'collectionName'
  , 'create'
  , 'fields'
  , 'update'
  , 'remove'
  , 'beforeCreate'
  , 'aroundCreate'
  , 'afterCreate'
  , 'beforeUpdate'
  , 'aroundUpdate'
  , 'afterUpdate'];

  fields = {};
  for (field in this) {
    if (-1 === notFields.indexOf(field)) fields[field] = this[field];
  }
  return fields;
};

// make a Model instace for a record
MongojitoModel.bakeModelsFromItems = function(items, _model) {
  var field, item, model, models, _i, _len;
  models = [];
  for (_i = 0, _len = items.length; _i < _len; _i++) {
    item = items[_i];
    item._id = item._id.toString();
    model = new _model;
    model.collectionName = _model.collectionName;
    for (field in item) {
      model[field] = item[field];
    }
    models.push(model);
  }
  return models;
};


// Simple wrapper for find
MongojitoModel.find = function(options, callback) {
  var key, query, that;
  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else {
    if (options.callback) {
      callback = options.callback;
      delete options.callback;
    }
  }
  that = this;
  query = function(done) {
    var fields, notFields, property, request;
    fields = {};
    notFields = ['limit', 'skip', 'sort'];
    for (property in options) {
      if (options.hasOwnProperty(property) && notFields.indexOf(property) === -1) {
        fields[property] = options[property];
      }
    }
    request = Client.collection(that.collectionName).find(fields);
    if (options.limit) request = request.limit(options.limit);
    if (options.skip) request = request.skip(options.skip);
    if (options.sort) request = request.sort(options.sort);
    return request.toArray(function(err, items) {
      var item, _i, _len;
      for (_i = 0, _len = items.length; _i < _len; _i++) {
        item = items[_i];
        item._id = item._id.toString();
      }
      return done(err, items);
    });
  };
  if (!Cache) {
    return query(function(err, items) {
      var models;
      models = that.bakeModelsFromItems(items, that.model);
      return callback(err, models);
    });
  }
  key = "" + this.collectionName + "-" + (JSON.stringify(options));
  return Cache.get(key, function(err, result) {
    var models;
    if (!result) {
      return query(function(err, items) {
        return Cache.set(key, JSON.stringify(items), 86400, [that.collectionName], function() {
          var models;
          models = that.bakeModelsFromItems(items, that.model);
          return callback(err, models);
        });
      });
    } else {
      models = that.bakeModelsFromItems(JSON.parse(result), that.model);
      return callback(err, models);
    }
  });
};

// wrapper to save a Model instance
MongojitoModel.prototype.save = function(callback) {
  var field, fields, keys, notFields, that;
  that = this;
  fields = this.fields();
  notFields = ['constructor', 'save', 'collectionName', 'create', 'fields', 'update', 'remove', 'models'];
  keys = [];
  for (field in this) {
    if (-1 === notFields.indexOf(field)) keys.push(field);
  }
  return async.filter(keys, function(key, nextKey) {
    if (that["validate" + (inflect.camelize(key))]) {
      return that["validate" + (inflect.camelize(key))](function(valid) {
        return nextKey(!valid);
      });
    } else {
      return nextKey(false);
    }
  }, function(results) {
    var performOperation;
    if (results.length > 0) return callback(true, results);
    performOperation = function() {
      if (fields._id) {
        return that.update(callback, true);
      } else {
        return that.create(callback, true);
      }
    };
    if (Cache) {
      return Cache.delByTag(that.collectionName, performOperation);
    } else {
      return performOperation();
    }
  });
};

// executes hooks and save a new Model
MongojitoModel.prototype.create = function(callback, fromSave) {
  var object, that;
  if (fromSave == null) fromSave = false;
  object = this.fields();
  if (this['beforeCreate']) this.beforeCreate();
  if (this['aroundCreate']) this.aroundCreate();
  that = this;
  return Client.collection(this.collectionName).insert(object, function(err, result) {
    result._id = result._id.toString();
    that._id = result._id;
    if (that['aroundCreate']) that.aroundCreate();
    if (that['afterCreate']) that.afterCreate();
    if (callback) return callback(err, result);
  });
};

// updates a model
MongojitoModel.prototype.update = function(callback, fromSave) {
  var object, that, _id;
  if (fromSave == null) fromSave = false;
  object = this.fields();
  _id = new mongolian.ObjectId(object._id);
  delete object._id;
  if (this['beforeUpdate']) this.beforeUpdate();
  if (this['aroundUpdate']) this.aroundUpdate();
  that = this;
  return Client.collection(this.collectionName).update({
    _id: _id
  }, object, function(err, rowsUpdated) {
    if (that['aroundUpdate']) that.aroundUpdate();
    if (that['afterUpdate']) that.afterUpdate();
    if (callback) return callback(err, rowsUpdated);
  });
};

// remove a model from the database
MongojitoModel.prototype.remove = function(callback) {
  var object, query, that, _id;
  object = this.fields();
  _id = new mongolian.ObjectId(object._id);
  if (this['beforeRemove']) this.beforeRemove();
  if (this['aroundRemove']) this.aroundRemove();
  that = this;
  query = function() {
    return Client.collection(that.collectionName).remove({
      _id: _id
    }, function(err) {
      if (that['aroundRemove']) that.aroundRemove();
      if (that['afterRemove']) that.afterRemove();
      if (callback) return callback(err);
    });
  };
  return query();
};

// wrapper around **mongolian.ObjectId** to create an ObjectId from a string
MongojitoModel.ObjectId = function(id){
  return new mongolian.ObjectId(id);
}