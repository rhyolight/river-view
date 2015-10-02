// Generated by CoffeeScript 1.10.0
var Connection, Consumer, Dataset, EventEmitter, Operation, Producer, Query, addExpr, base64Lookup, expr, extend, handleLiteral, handleOrder, httpClient, isArray, isNumber, isString, rawToBase64, toBase64, toQuerystring,
  slice = [].slice,
  hasProp = {}.hasOwnProperty;

EventEmitter = require('eventemitter2').EventEmitter2;

httpClient = require('superagent');

isString = function(obj) {
  return toString.call(obj) === '[object String]';
};

isArray = function(obj) {
  return toString.call(obj) === '[object Array]';
};

isNumber = function(obj) {
  return toString.call(obj) === '[object Number]';
};

extend = function() {
  var j, k, len, source, sources, target, v;
  target = arguments[0], sources = 2 <= arguments.length ? slice.call(arguments, 1) : [];
  for (j = 0, len = sources.length; j < len; j++) {
    source = sources[j];
    for (k in source) {
      v = source[k];
      target[k] = v;
    }
  }
  return null;
};

toBase64 = typeof Buffer !== "undefined" && Buffer !== null ? function(str) {
  return new Buffer(str).toString('base64');
} : (base64Lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='.split(''), rawToBase64 = typeof btoa !== "undefined" && btoa !== null ? btoa : function(str) {
  var chr1, chr2, chr3, enc1, enc2, enc3, enc4, i, result;
  result = [];
  i = 0;
  while (i < str.length) {
    chr1 = str.charCodeAt(i++);
    chr2 = str.charCodeAt(i++);
    chr3 = str.charCodeAt(i++);
    if (Math.max(chr1, chr2, chr3) > 0xFF) {
      throw new Error('Invalid character!');
    }
    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = chr3 & 63;
    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }
    result.push(base64Lookup[enc1]);
    result.push(base64Lookup[enc2]);
    result.push(base64Lookup[enc3]);
    result.push(base64Lookup[enc4]);
  }
  return result.join('');
}, function(str) {
  return rawToBase64(unescape(encodeURIComponent(str)));
});

handleLiteral = function(literal) {
  if (isString(literal)) {
    return "'" + literal + "'";
  } else if (isNumber(literal)) {
    return literal;
  } else {
    return literal;
  }
};

handleOrder = function(order) {
  if (/( asc$| desc$)/i.test(order)) {
    return order;
  } else {
    return order + ' asc';
  }
};

addExpr = function(target, args) {
  var arg, j, k, len, results, v;
  results = [];
  for (j = 0, len = args.length; j < len; j++) {
    arg = args[j];
    if (isString(arg)) {
      results.push(target.push(arg));
    } else {
      results.push((function() {
        var results1;
        results1 = [];
        for (k in arg) {
          v = arg[k];
          results1.push(target.push(k + " = " + (handleLiteral(v))));
        }
        return results1;
      })());
    }
  }
  return results;
};

expr = {
  and: function() {
    var clause, clauses;
    clauses = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    return ((function() {
      var j, len, results;
      results = [];
      for (j = 0, len = clauses.length; j < len; j++) {
        clause = clauses[j];
        results.push("(" + clause + ")");
      }
      return results;
    })()).join(' and ');
  },
  or: function() {
    var clause, clauses;
    clauses = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    return ((function() {
      var j, len, results;
      results = [];
      for (j = 0, len = clauses.length; j < len; j++) {
        clause = clauses[j];
        results.push("(" + clause + ")");
      }
      return results;
    })()).join(' or ');
  },
  gt: function(column, literal) {
    return column + " > " + (handleLiteral(literal));
  },
  gte: function(column, literal) {
    return column + " >= " + (handleLiteral(literal));
  },
  lt: function(column, literal) {
    return column + " < " + (handleLiteral(literal));
  },
  lte: function(column, literal) {
    return column + " <= " + (handleLiteral(literal));
  },
  eq: function(column, literal) {
    return column + " = " + (handleLiteral(literal));
  }
};

toQuerystring = function(obj) {
  var key, str, val;
  str = [];
  for (key in obj) {
    if (!hasProp.call(obj, key)) continue;
    val = obj[key];
    str.push(encodeURIComponent(key) + '=' + encodeURIComponent(val));
  }
  return str.join('&');
};

Connection = (function() {
  function Connection(dataSite1, sodaOpts1) {
    var ref;
    this.dataSite = dataSite1;
    this.sodaOpts = sodaOpts1 != null ? sodaOpts1 : {};
    if (!/^[a-z0-9-_.]+(:[0-9]+)?$/i.test(this.dataSite)) {
      throw new Error('dataSite does not appear to be valid! Please supply a domain name, eg data.seattle.gov');
    }
    this.emitterOpts = (ref = this.sodaOpts.emitterOpts) != null ? ref : {
      wildcard: true,
      delimiter: '.',
      maxListeners: 15
    };
    this.networker = function(opts, data) {
      var client, url;
      url = "https://" + this.dataSite + opts.path;
      client = httpClient(opts.method, url);
      if (data != null) {
        client.set('Accept', "application/json");
      }
      if (data != null) {
        client.set('Content-type', "application/json");
      }
      if (this.sodaOpts.apiToken != null) {
        client.set('X-App-Token', this.sodaOpts.apiToken);
      }
      if ((this.sodaOpts.username != null) && (this.sodaOpts.password != null)) {
        client.set('Authorization', "Basic " + toBase64(this.sodaOpts.username + ":" + this.sodaOpts.password));
      }
      if (this.sodaOpts.accessToken != null) {
        client.set('Authorization', "OAuth " + accessToken);
      }
      if (opts.query != null) {
        client.query(opts.query);
      }
      if (data != null) {
        client.send(data);
      }
      return (function(_this) {
        return function(responseHandler) {
          return client.end(responseHandler || _this.getDefaultHandler());
        };
      })(this);
    };
  }

  Connection.prototype.getDefaultHandler = function() {
    var emitter, handler;
    this.emitter = emitter = new EventEmitter(this.emitterOpts);
    return handler = function(error, response) {
      var ref;
      if (response && response.ok) {
        if (response.accepted) {
          emitter.emit('progress', response.body);
          setTimeout((function() {
            return this.consumer.networker(opts)(handler);
          }), 5000);
        } else {
          emitter.emit('success', response.body);
        }
      } else {
        emitter.emit('error', (ref = response.body) != null ? ref : response.text);
      }
      return emitter.emit('complete', response);
    };
  };

  return Connection;

})();

Consumer = (function() {
  function Consumer(dataSite1, sodaOpts1) {
    this.dataSite = dataSite1;
    this.sodaOpts = sodaOpts1 != null ? sodaOpts1 : {};
    this.connection = new Connection(this.dataSite, this.sodaOpts);
  }

  Consumer.prototype.query = function() {
    return new Query(this);
  };

  Consumer.prototype.getDataset = function(id) {
    var emitter;
    return emitter = new EventEmitter(this.emitterOpts);
  };

  return Consumer;

})();

Producer = (function() {
  function Producer(dataSite1, sodaOpts1) {
    this.dataSite = dataSite1;
    this.sodaOpts = sodaOpts1 != null ? sodaOpts1 : {};
    this.connection = new Connection(dataSite, sodaOpts);
  }

  Producer.prototype.operation = function() {
    return new Operation(this);
  };

  return Producer;

})();

Operation = (function() {
  function Operation(producer) {
    this.producer = producer;
  }

  Operation.prototype.withDataset = function(datasetId) {
    this._datasetId = datasetId;
    return this;
  };

  Operation.prototype.truncate = function() {
    var opts;
    opts = {
      method: 'delete'
    };
    opts.path = "/resource/" + this._datasetId;
    return this._exec(opts);
  };

  Operation.prototype.add = function(data) {
    var _data, j, len, obj, opts;
    opts = {
      method: 'post'
    };
    opts.path = "/resource/" + this._datasetId;
    _data = JSON.parse(JSON.stringify(data));
    delete _data[':id'];
    delete _data[':delete'];
    for (j = 0, len = _data.length; j < len; j++) {
      obj = _data[j];
      delete obj[':id'];
      delete obj[':delete'];
    }
    return this._exec(opts, _data);
  };

  Operation.prototype["delete"] = function(id) {
    var opts;
    opts = {
      method: 'delete'
    };
    opts.path = "/resource/" + this._datasetId + "/" + id;
    return this._exec(opts);
  };

  Operation.prototype.update = function(id, data) {
    var opts;
    opts = {
      method: 'post'
    };
    opts.path = "/resource/" + this._datasetId + "/" + id;
    return this._exec(opts, data);
  };

  Operation.prototype.replace = function(id, data) {
    var opts;
    opts = {
      method: 'put'
    };
    opts.path = "/resource/" + this._datasetId + "/" + id;
    return this._exec(opts, data);
  };

  Operation.prototype.upsert = function(data) {
    var opts;
    opts = {
      method: 'post'
    };
    opts.path = "/resource/" + this._datasetId;
    return this._exec(opts, data);
  };

  Operation.prototype._exec = function(opts, data) {
    if (this._datasetId == null) {
      throw new Error('no dataset given to work against!');
    }
    this.producer.connection.networker(opts, data)();
    return this.producer.connection.emitter;
  };

  return Operation;

})();

Query = (function() {
  function Query(consumer) {
    this.consumer = consumer;
    this._select = [];
    this._where = [];
    this._group = [];
    this._having = [];
    this._order = [];
    this._offset = this._limit = this._q = null;
  }

  Query.prototype.withDataset = function(datasetId) {
    this._datasetId = datasetId;
    return this;
  };

  Query.prototype.soql = function(query) {
    this._soql = query;
    return this;
  };

  Query.prototype.select = function() {
    var j, len, select, selects;
    selects = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    for (j = 0, len = selects.length; j < len; j++) {
      select = selects[j];
      this._select.push(select);
    }
    return this;
  };

  Query.prototype.where = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    addExpr(this._where, args);
    return this;
  };

  Query.prototype.having = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    addExpr(this._having, args);
    return this;
  };

  Query.prototype.group = function() {
    var group, groups, j, len;
    groups = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    for (j = 0, len = groups.length; j < len; j++) {
      group = groups[j];
      this._group.push(group);
    }
    return this;
  };

  Query.prototype.order = function() {
    var j, len, order, orders;
    orders = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    for (j = 0, len = orders.length; j < len; j++) {
      order = orders[j];
      this._order.push(handleOrder(order));
    }
    return this;
  };

  Query.prototype.offset = function(offset) {
    this._offset = offset;
    return this;
  };

  Query.prototype.limit = function(limit) {
    this._limit = limit;
    return this;
  };

  Query.prototype.q = function(q) {
    this._q = q;
    return this;
  };

  Query.prototype.getOpts = function() {
    var k, opts, queryComponents, v;
    opts = {
      method: 'get'
    };
    if (this._datasetId == null) {
      throw new Error('no dataset given to work against!');
    }
    opts.path = "/resource/" + this._datasetId + ".json";
    queryComponents = this._buildQueryComponents();
    opts.query = {};
    for (k in queryComponents) {
      v = queryComponents[k];
      opts.query['$' + k] = v;
    }
    return opts;
  };

  Query.prototype.getURL = function() {
    var opts, query;
    opts = this.getOpts();
    query = toQuerystring(opts.query);
    return ("https://" + this.consumer.dataSite + opts.path) + (query ? "?" + query : "");
  };

  Query.prototype.getRows = function() {
    var opts;
    opts = this.getOpts();
    this.consumer.connection.networker(opts)();
    return this.consumer.connection.emitter;
  };

  Query.prototype._buildQueryComponents = function() {
    var query;
    query = {};
    if (this._soql != null) {
      query.query = this._soql;
    } else {
      if (this._select.length > 0) {
        query.select = this._select.join(', ');
      }
      if (this._where.length > 0) {
        query.where = expr.and.apply(this, this._where);
      }
      if (this._group.length > 0) {
        query.group = this._group.join(', ');
      }
      if (this._having.length > 0) {
        if (!(this._group.length > 0)) {
          throw new Error('Having provided without group by!');
        }
        query.having = expr.and.apply(this, this._having);
      }
      if (this._order.length > 0) {
        query.order = this._order.join(', ');
      }
      if (isNumber(this._offset)) {
        query.offset = this._offset;
      }
      if (isNumber(this._limit)) {
        query.limit = this._limit;
      }
      if (this._q) {
        query.q = this._q;
      }
    }
    return query;
  };

  return Query;

})();

Dataset = (function() {
  function Dataset(data1, client1) {
    this.data = data1;
    this.client = client1;
  }

  return Dataset;

})();

extend(typeof exports !== "undefined" && exports !== null ? exports : this.soda, {
  Consumer: Consumer,
  Producer: Producer,
  expr: expr,
  _internal: {
    Connection: Connection,
    Query: Query,
    Operation: Operation,
    util: {
      toBase64: toBase64,
      handleLiteral: handleLiteral,
      handleOrder: handleOrder
    }
  }
});