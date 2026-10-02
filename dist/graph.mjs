import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __f2p } from 'node:url'; import { dirname as __dn } from 'node:path'; const require = __cr(import.meta.url); const __filename = __f2p(import.meta.url); const __dirname = __dn(__filename);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/graphology-utils/defaults.js
var require_defaults = __commonJS({
  "node_modules/graphology-utils/defaults.js"(exports2, module2) {
    function isLeaf(o) {
      return !o || typeof o !== "object" || typeof o === "function" || Array.isArray(o) || o instanceof Set || o instanceof Map || o instanceof RegExp || o instanceof Date;
    }
    function resolveDefaults(target, defaults) {
      target = target || {};
      var output = {};
      for (var k in defaults) {
        var existing = target[k];
        var def = defaults[k];
        if (!isLeaf(def)) {
          output[k] = resolveDefaults(existing, def);
          continue;
        }
        if (existing === void 0) {
          output[k] = def;
        } else {
          output[k] = existing;
        }
      }
      return output;
    }
    module2.exports = resolveDefaults;
  }
});

// node_modules/graphology-utils/is-graph.js
var require_is_graph = __commonJS({
  "node_modules/graphology-utils/is-graph.js"(exports2, module2) {
    module2.exports = function isGraph(value) {
      return value !== null && typeof value === "object" && typeof value.addUndirectedEdgeWithKey === "function" && typeof value.dropNode === "function" && typeof value.multi === "boolean";
    };
  }
});

// node_modules/graphology-utils/infer-type.js
var require_infer_type = __commonJS({
  "node_modules/graphology-utils/infer-type.js"(exports2, module2) {
    var isGraph = require_is_graph();
    module2.exports = function inferType(graph) {
      if (!isGraph(graph))
        throw new Error(
          "graphology-utils/infer-type: expecting a valid graphology instance."
        );
      var declaredType = graph.type;
      if (declaredType !== "mixed") return declaredType;
      if (graph.directedSize === 0 && graph.undirectedSize === 0 || graph.directedSize > 0 && graph.undirectedSize > 0)
        return "mixed";
      if (graph.directedSize > 0) return "directed";
      return "undirected";
    };
  }
});

// node_modules/obliterator/iterator.js
var require_iterator = __commonJS({
  "node_modules/obliterator/iterator.js"(exports2, module2) {
    function Iterator(next) {
      if (typeof next !== "function")
        throw new Error("obliterator/iterator: expecting a function!");
      this.next = next;
    }
    if (typeof Symbol !== "undefined")
      Iterator.prototype[Symbol.iterator] = function() {
        return this;
      };
    Iterator.of = function() {
      var args2 = arguments, l = args2.length, i2 = 0;
      return new Iterator(function() {
        if (i2 >= l) return { done: true };
        return { done: false, value: args2[i2++] };
      });
    };
    Iterator.empty = function() {
      var iterator = new Iterator(function() {
        return { done: true };
      });
      return iterator;
    };
    Iterator.fromSequence = function(sequence) {
      var i2 = 0, l = sequence.length;
      return new Iterator(function() {
        if (i2 >= l) return { done: true };
        return { done: false, value: sequence[i2++] };
      });
    };
    Iterator.is = function(value) {
      if (value instanceof Iterator) return true;
      return typeof value === "object" && value !== null && typeof value.next === "function";
    };
    module2.exports = Iterator;
  }
});

// node_modules/mnemonist/utils/typed-arrays.js
var require_typed_arrays = __commonJS({
  "node_modules/mnemonist/utils/typed-arrays.js"(exports2) {
    var MAX_8BIT_INTEGER = Math.pow(2, 8) - 1;
    var MAX_16BIT_INTEGER = Math.pow(2, 16) - 1;
    var MAX_32BIT_INTEGER = Math.pow(2, 32) - 1;
    var MAX_SIGNED_8BIT_INTEGER = Math.pow(2, 7) - 1;
    var MAX_SIGNED_16BIT_INTEGER = Math.pow(2, 15) - 1;
    var MAX_SIGNED_32BIT_INTEGER = Math.pow(2, 31) - 1;
    exports2.getPointerArray = function(size) {
      var maxIndex = size - 1;
      if (maxIndex <= MAX_8BIT_INTEGER)
        return Uint8Array;
      if (maxIndex <= MAX_16BIT_INTEGER)
        return Uint16Array;
      if (maxIndex <= MAX_32BIT_INTEGER)
        return Uint32Array;
      throw new Error("mnemonist: Pointer Array of size > 4294967295 is not supported.");
    };
    exports2.getSignedPointerArray = function(size) {
      var maxIndex = size - 1;
      if (maxIndex <= MAX_SIGNED_8BIT_INTEGER)
        return Int8Array;
      if (maxIndex <= MAX_SIGNED_16BIT_INTEGER)
        return Int16Array;
      if (maxIndex <= MAX_SIGNED_32BIT_INTEGER)
        return Int32Array;
      return Float64Array;
    };
    exports2.getNumberType = function(value) {
      if (value === (value | 0)) {
        if (Math.sign(value) === -1) {
          if (value <= 127 && value >= -128)
            return Int8Array;
          if (value <= 32767 && value >= -32768)
            return Int16Array;
          return Int32Array;
        } else {
          if (value <= 255)
            return Uint8Array;
          if (value <= 65535)
            return Uint16Array;
          return Uint32Array;
        }
      }
      return Float64Array;
    };
    var TYPE_PRIORITY = {
      Uint8Array: 1,
      Int8Array: 2,
      Uint16Array: 3,
      Int16Array: 4,
      Uint32Array: 5,
      Int32Array: 6,
      Float32Array: 7,
      Float64Array: 8
    };
    exports2.getMinimalRepresentation = function(array, getter) {
      var maxType = null, maxPriority = 0, p, t, v, i2, l;
      for (i2 = 0, l = array.length; i2 < l; i2++) {
        v = getter ? getter(array[i2]) : array[i2];
        t = exports2.getNumberType(v);
        p = TYPE_PRIORITY[t.name];
        if (p > maxPriority) {
          maxPriority = p;
          maxType = t;
        }
      }
      return maxType;
    };
    exports2.isTypedArray = function(value) {
      return typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value);
    };
    exports2.concat = function() {
      var length = 0, i2, o, l;
      for (i2 = 0, l = arguments.length; i2 < l; i2++)
        length += arguments[i2].length;
      var array = new arguments[0].constructor(length);
      for (i2 = 0, o = 0; i2 < l; i2++) {
        array.set(arguments[i2], o);
        o += arguments[i2].length;
      }
      return array;
    };
    exports2.indices = function(length) {
      var PointerArray = exports2.getPointerArray(length);
      var array = new PointerArray(length);
      for (var i2 = 0; i2 < length; i2++)
        array[i2] = i2;
      return array;
    };
  }
});

// node_modules/mnemonist/sparse-map.js
var require_sparse_map = __commonJS({
  "node_modules/mnemonist/sparse-map.js"(exports2, module2) {
    var Iterator = require_iterator();
    var getPointerArray = require_typed_arrays().getPointerArray;
    function SparseMap(Values, length) {
      if (arguments.length < 2) {
        length = Values;
        Values = Array;
      }
      var ByteArray = getPointerArray(length);
      this.size = 0;
      this.length = length;
      this.dense = new ByteArray(length);
      this.sparse = new ByteArray(length);
      this.vals = new Values(length);
    }
    SparseMap.prototype.clear = function() {
      this.size = 0;
    };
    SparseMap.prototype.has = function(member) {
      var index = this.sparse[member];
      return index < this.size && this.dense[index] === member;
    };
    SparseMap.prototype.get = function(member) {
      var index = this.sparse[member];
      if (index < this.size && this.dense[index] === member)
        return this.vals[index];
      return;
    };
    SparseMap.prototype.set = function(member, value) {
      var index = this.sparse[member];
      if (index < this.size && this.dense[index] === member) {
        this.vals[index] = value;
        return this;
      }
      this.dense[this.size] = member;
      this.sparse[member] = this.size;
      this.vals[this.size] = value;
      this.size++;
      return this;
    };
    SparseMap.prototype.delete = function(member) {
      var index = this.sparse[member];
      if (index >= this.size || this.dense[index] !== member)
        return false;
      index = this.dense[this.size - 1];
      this.dense[this.sparse[member]] = index;
      this.sparse[index] = this.sparse[member];
      this.size--;
      return true;
    };
    SparseMap.prototype.forEach = function(callback, scope) {
      scope = arguments.length > 1 ? scope : this;
      for (var i2 = 0; i2 < this.size; i2++)
        callback.call(scope, this.vals[i2], this.dense[i2]);
    };
    SparseMap.prototype.keys = function() {
      var size = this.size, dense = this.dense, i2 = 0;
      return new Iterator(function() {
        if (i2 < size) {
          var item = dense[i2];
          i2++;
          return {
            value: item
          };
        }
        return {
          done: true
        };
      });
    };
    SparseMap.prototype.values = function() {
      var size = this.size, values = this.vals, i2 = 0;
      return new Iterator(function() {
        if (i2 < size) {
          var item = values[i2];
          i2++;
          return {
            value: item
          };
        }
        return {
          done: true
        };
      });
    };
    SparseMap.prototype.entries = function() {
      var size = this.size, dense = this.dense, values = this.vals, i2 = 0;
      return new Iterator(function() {
        if (i2 < size) {
          var item = [dense[i2], values[i2]];
          i2++;
          return {
            value: item
          };
        }
        return {
          done: true
        };
      });
    };
    if (typeof Symbol !== "undefined")
      SparseMap.prototype[Symbol.iterator] = SparseMap.prototype.entries;
    SparseMap.prototype.inspect = function() {
      var proxy2 = /* @__PURE__ */ new Map();
      for (var i2 = 0; i2 < this.size; i2++)
        proxy2.set(this.dense[i2], this.vals[i2]);
      Object.defineProperty(proxy2, "constructor", {
        value: SparseMap,
        enumerable: false
      });
      proxy2.length = this.length;
      if (this.vals.constructor !== Array)
        proxy2.type = this.vals.constructor.name;
      return proxy2;
    };
    if (typeof Symbol !== "undefined")
      SparseMap.prototype[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = SparseMap.prototype.inspect;
    module2.exports = SparseMap;
  }
});

// node_modules/mnemonist/sparse-queue-set.js
var require_sparse_queue_set = __commonJS({
  "node_modules/mnemonist/sparse-queue-set.js"(exports2, module2) {
    var Iterator = require_iterator();
    var getPointerArray = require_typed_arrays().getPointerArray;
    function SparseQueueSet(capacity) {
      var ByteArray = getPointerArray(capacity);
      this.start = 0;
      this.size = 0;
      this.capacity = capacity;
      this.dense = new ByteArray(capacity);
      this.sparse = new ByteArray(capacity);
    }
    SparseQueueSet.prototype.clear = function() {
      this.start = 0;
      this.size = 0;
    };
    SparseQueueSet.prototype.has = function(member) {
      if (this.size === 0)
        return false;
      var index = this.sparse[member];
      var inBounds = index < this.capacity && (index >= this.start && index < this.start + this.size) || index < (this.start + this.size) % this.capacity;
      return inBounds && this.dense[index] === member;
    };
    SparseQueueSet.prototype.enqueue = function(member) {
      var index = this.sparse[member];
      if (this.size !== 0) {
        var inBounds = index < this.capacity && (index >= this.start && index < this.start + this.size) || index < (this.start + this.size) % this.capacity;
        if (inBounds && this.dense[index] === member)
          return this;
      }
      index = (this.start + this.size) % this.capacity;
      this.dense[index] = member;
      this.sparse[member] = index;
      this.size++;
      return this;
    };
    SparseQueueSet.prototype.dequeue = function() {
      if (this.size === 0)
        return;
      var index = this.start;
      this.size--;
      this.start++;
      if (this.start === this.capacity)
        this.start = 0;
      var member = this.dense[index];
      this.sparse[member] = this.capacity;
      return member;
    };
    SparseQueueSet.prototype.forEach = function(callback, scope) {
      scope = arguments.length > 1 ? scope : this;
      var c = this.capacity, l = this.size, i2 = this.start, j = 0;
      while (j < l) {
        callback.call(scope, this.dense[i2], j, this);
        i2++;
        j++;
        if (i2 === c)
          i2 = 0;
      }
    };
    SparseQueueSet.prototype.values = function() {
      var dense = this.dense, c = this.capacity, l = this.size, i2 = this.start, j = 0;
      return new Iterator(function() {
        if (j >= l)
          return {
            done: true
          };
        var value = dense[i2];
        i2++;
        j++;
        if (i2 === c)
          i2 = 0;
        return {
          value,
          done: false
        };
      });
    };
    if (typeof Symbol !== "undefined")
      SparseQueueSet.prototype[Symbol.iterator] = SparseQueueSet.prototype.values;
    SparseQueueSet.prototype.inspect = function() {
      var proxy2 = [];
      this.forEach(function(member) {
        proxy2.push(member);
      });
      Object.defineProperty(proxy2, "constructor", {
        value: SparseQueueSet,
        enumerable: false
      });
      proxy2.capacity = this.capacity;
      return proxy2;
    };
    if (typeof Symbol !== "undefined")
      SparseQueueSet.prototype[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = SparseQueueSet.prototype.inspect;
    module2.exports = SparseQueueSet;
  }
});

// node_modules/pandemonium/random-index.js
var require_random_index = __commonJS({
  "node_modules/pandemonium/random-index.js"(exports2, module2) {
    function createRandomIndex(rng2) {
      return function(length) {
        if (typeof length !== "number") length = length.length;
        return Math.floor(rng2() * length);
      };
    }
    var randomIndex = createRandomIndex(Math.random);
    randomIndex.createRandomIndex = createRandomIndex;
    module2.exports = randomIndex;
  }
});

// node_modules/graphology-utils/getters.js
var require_getters = __commonJS({
  "node_modules/graphology-utils/getters.js"(exports2) {
    function coerceWeight(value) {
      if (typeof value !== "number" || isNaN(value)) return 1;
      return value;
    }
    function createNodeValueGetter(nameOrFunction, defaultValue) {
      var getter = {};
      var coerceToDefault = function(v) {
        if (typeof v === "undefined") return defaultValue;
        return v;
      };
      if (typeof defaultValue === "function") coerceToDefault = defaultValue;
      var get = function(attributes) {
        return coerceToDefault(attributes[nameOrFunction]);
      };
      var returnDefault = function() {
        return coerceToDefault(void 0);
      };
      if (typeof nameOrFunction === "string") {
        getter.fromAttributes = get;
        getter.fromGraph = function(graph, node) {
          return get(graph.getNodeAttributes(node));
        };
        getter.fromEntry = function(node, attributes) {
          return get(attributes);
        };
      } else if (typeof nameOrFunction === "function") {
        getter.fromAttributes = function() {
          throw new Error(
            "graphology-utils/getters/createNodeValueGetter: irrelevant usage."
          );
        };
        getter.fromGraph = function(graph, node) {
          return coerceToDefault(
            nameOrFunction(node, graph.getNodeAttributes(node))
          );
        };
        getter.fromEntry = function(node, attributes) {
          return coerceToDefault(nameOrFunction(node, attributes));
        };
      } else {
        getter.fromAttributes = returnDefault;
        getter.fromGraph = returnDefault;
        getter.fromEntry = returnDefault;
      }
      return getter;
    }
    function createEdgeValueGetter(nameOrFunction, defaultValue) {
      var getter = {};
      var coerceToDefault = function(v) {
        if (typeof v === "undefined") return defaultValue;
        return v;
      };
      if (typeof defaultValue === "function") coerceToDefault = defaultValue;
      var get = function(attributes) {
        return coerceToDefault(attributes[nameOrFunction]);
      };
      var returnDefault = function() {
        return coerceToDefault(void 0);
      };
      if (typeof nameOrFunction === "string") {
        getter.fromAttributes = get;
        getter.fromGraph = function(graph, edge2) {
          return get(graph.getEdgeAttributes(edge2));
        };
        getter.fromEntry = function(edge2, attributes) {
          return get(attributes);
        };
        getter.fromPartialEntry = getter.fromEntry;
        getter.fromMinimalEntry = getter.fromEntry;
      } else if (typeof nameOrFunction === "function") {
        getter.fromAttributes = function() {
          throw new Error(
            "graphology-utils/getters/createEdgeValueGetter: irrelevant usage."
          );
        };
        getter.fromGraph = function(graph, edge2) {
          var extremities = graph.extremities(edge2);
          return coerceToDefault(
            nameOrFunction(
              edge2,
              graph.getEdgeAttributes(edge2),
              extremities[0],
              extremities[1],
              graph.getNodeAttributes(extremities[0]),
              graph.getNodeAttributes(extremities[1]),
              graph.isUndirected(edge2)
            )
          );
        };
        getter.fromEntry = function(e, a, s, t, sa, ta, u) {
          return coerceToDefault(nameOrFunction(e, a, s, t, sa, ta, u));
        };
        getter.fromPartialEntry = function(e, a, s, t) {
          return coerceToDefault(nameOrFunction(e, a, s, t));
        };
        getter.fromMinimalEntry = function(e, a) {
          return coerceToDefault(nameOrFunction(e, a));
        };
      } else {
        getter.fromAttributes = returnDefault;
        getter.fromGraph = returnDefault;
        getter.fromEntry = returnDefault;
        getter.fromMinimalEntry = returnDefault;
      }
      return getter;
    }
    exports2.createNodeValueGetter = createNodeValueGetter;
    exports2.createEdgeValueGetter = createEdgeValueGetter;
    exports2.createEdgeWeightGetter = function(name2) {
      return createEdgeValueGetter(name2, coerceWeight);
    };
  }
});

// node_modules/graphology-indices/louvain.js
var require_louvain = __commonJS({
  "node_modules/graphology-indices/louvain.js"(exports2) {
    var typed = require_typed_arrays();
    var resolveDefaults = require_defaults();
    var createEdgeWeightGetter = require_getters().createEdgeWeightGetter;
    var INSPECT = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom");
    var DEFAULTS2 = {
      getEdgeWeight: "weight",
      keepDendrogram: false,
      resolution: 1
    };
    function UndirectedLouvainIndex(graph, options) {
      options = resolveDefaults(options, DEFAULTS2);
      var resolution = options.resolution;
      var getEdgeWeight = createEdgeWeightGetter(options.getEdgeWeight).fromEntry;
      var size = (graph.size - graph.selfLoopCount) * 2;
      var NeighborhoodPointerArray = typed.getPointerArray(size);
      var NodesPointerArray = typed.getPointerArray(graph.order + 1);
      var WeightsArray = options.getEdgeWeight ? Float64Array : typed.getPointerArray(graph.size * 2);
      this.C = graph.order;
      this.M = 0;
      this.E = size;
      this.U = 0;
      this.resolution = resolution;
      this.level = 0;
      this.graph = graph;
      this.nodes = new Array(graph.order);
      this.keepDendrogram = options.keepDendrogram;
      this.neighborhood = new NodesPointerArray(size);
      this.weights = new WeightsArray(size);
      this.loops = new WeightsArray(graph.order);
      this.starts = new NeighborhoodPointerArray(graph.order + 1);
      this.belongings = new NodesPointerArray(graph.order);
      this.dendrogram = [];
      this.mapping = null;
      this.counts = new NodesPointerArray(graph.order);
      this.unused = new NodesPointerArray(graph.order);
      this.totalWeights = new WeightsArray(graph.order);
      var ids = {};
      var weight;
      var i2 = 0, n = 0;
      var self2 = this;
      graph.forEachNode(function(node) {
        self2.nodes[i2] = node;
        ids[node] = i2;
        n += graph.undirectedDegreeWithoutSelfLoops(node);
        self2.starts[i2] = n;
        self2.belongings[i2] = i2;
        self2.counts[i2] = 1;
        i2++;
      });
      graph.forEachEdge(function(edge2, attr, source, target, sa, ta, u) {
        weight = getEdgeWeight(edge2, attr, source, target, sa, ta, u);
        source = ids[source];
        target = ids[target];
        self2.M += weight;
        if (source === target) {
          self2.totalWeights[source] += weight * 2;
          self2.loops[source] = weight * 2;
        } else {
          self2.totalWeights[source] += weight;
          self2.totalWeights[target] += weight;
          var startSource = --self2.starts[source], startTarget = --self2.starts[target];
          self2.neighborhood[startSource] = target;
          self2.neighborhood[startTarget] = source;
          self2.weights[startSource] = weight;
          self2.weights[startTarget] = weight;
        }
      });
      this.starts[i2] = this.E;
      if (this.keepDendrogram) this.dendrogram.push(this.belongings.slice());
      else this.mapping = this.belongings.slice();
    }
    UndirectedLouvainIndex.prototype.isolate = function(i2, degree) {
      var currentCommunity = this.belongings[i2];
      if (this.counts[currentCommunity] === 1) return currentCommunity;
      var newCommunity = this.unused[--this.U];
      var loops = this.loops[i2];
      this.totalWeights[currentCommunity] -= degree + loops;
      this.totalWeights[newCommunity] += degree + loops;
      this.belongings[i2] = newCommunity;
      this.counts[currentCommunity]--;
      this.counts[newCommunity]++;
      return newCommunity;
    };
    UndirectedLouvainIndex.prototype.move = function(i2, degree, targetCommunity) {
      var currentCommunity = this.belongings[i2], loops = this.loops[i2];
      this.totalWeights[currentCommunity] -= degree + loops;
      this.totalWeights[targetCommunity] += degree + loops;
      this.belongings[i2] = targetCommunity;
      var nowEmpty = this.counts[currentCommunity]-- === 1;
      this.counts[targetCommunity]++;
      if (nowEmpty) this.unused[this.U++] = currentCommunity;
    };
    UndirectedLouvainIndex.prototype.computeNodeDegree = function(i2) {
      var o, l, weight;
      var degree = 0;
      for (o = this.starts[i2], l = this.starts[i2 + 1]; o < l; o++) {
        weight = this.weights[o];
        degree += weight;
      }
      return degree;
    };
    UndirectedLouvainIndex.prototype.expensiveIsolate = function(i2) {
      var degree = this.computeNodeDegree(i2);
      return this.isolate(i2, degree);
    };
    UndirectedLouvainIndex.prototype.expensiveMove = function(i2, ci) {
      var degree = this.computeNodeDegree(i2);
      this.move(i2, degree, ci);
    };
    UndirectedLouvainIndex.prototype.zoomOut = function() {
      var inducedGraph = new Array(this.C - this.U), newLabels = {};
      var N = this.nodes.length;
      var C2 = 0, E = 0;
      var i2, j, l, m, n, ci, cj, data, adj;
      for (i2 = 0, l = this.C; i2 < l; i2++) {
        ci = this.belongings[i2];
        if (!(ci in newLabels)) {
          newLabels[ci] = C2;
          inducedGraph[C2] = {
            adj: {},
            totalWeights: this.totalWeights[ci],
            internalWeights: 0
          };
          C2++;
        }
        this.belongings[i2] = newLabels[ci];
      }
      var currentLevel, nextLevel;
      if (this.keepDendrogram) {
        currentLevel = this.dendrogram[this.level];
        nextLevel = new (typed.getPointerArray(C2))(N);
        for (i2 = 0; i2 < N; i2++) nextLevel[i2] = this.belongings[currentLevel[i2]];
        this.dendrogram.push(nextLevel);
      } else {
        for (i2 = 0; i2 < N; i2++) this.mapping[i2] = this.belongings[this.mapping[i2]];
      }
      for (i2 = 0, l = this.C; i2 < l; i2++) {
        ci = this.belongings[i2];
        data = inducedGraph[ci];
        adj = data.adj;
        data.internalWeights += this.loops[i2];
        for (j = this.starts[i2], m = this.starts[i2 + 1]; j < m; j++) {
          n = this.neighborhood[j];
          cj = this.belongings[n];
          if (ci === cj) {
            data.internalWeights += this.weights[j];
            continue;
          }
          if (!(cj in adj)) adj[cj] = 0;
          adj[cj] += this.weights[j];
        }
      }
      this.C = C2;
      n = 0;
      for (ci = 0; ci < C2; ci++) {
        data = inducedGraph[ci];
        adj = data.adj;
        ci = +ci;
        this.totalWeights[ci] = data.totalWeights;
        this.loops[ci] = data.internalWeights;
        this.counts[ci] = 1;
        this.starts[ci] = n;
        this.belongings[ci] = ci;
        for (cj in adj) {
          this.neighborhood[n] = +cj;
          this.weights[n] = adj[cj];
          E++;
          n++;
        }
      }
      this.starts[C2] = E;
      this.E = E;
      this.U = 0;
      this.level++;
      return newLabels;
    };
    UndirectedLouvainIndex.prototype.modularity = function() {
      var ci, cj, i2, j, m;
      var Q = 0;
      var M2 = this.M * 2;
      var internalWeights = new Float64Array(this.C);
      for (i2 = 0; i2 < this.C; i2++) {
        ci = this.belongings[i2];
        internalWeights[ci] += this.loops[i2];
        for (j = this.starts[i2], m = this.starts[i2 + 1]; j < m; j++) {
          cj = this.belongings[this.neighborhood[j]];
          if (ci !== cj) continue;
          internalWeights[ci] += this.weights[j];
        }
      }
      for (i2 = 0; i2 < this.C; i2++) {
        Q += internalWeights[i2] / M2 - Math.pow(this.totalWeights[i2] / M2, 2) * this.resolution;
      }
      return Q;
    };
    UndirectedLouvainIndex.prototype.delta = function(i2, degree, targetCommunityDegree, targetCommunity) {
      var M = this.M;
      var targetCommunityTotalWeight = this.totalWeights[targetCommunity];
      degree += this.loops[i2];
      return targetCommunityDegree / M - // NOTE: formula is a bit different here because targetCommunityDegree is passed without * 2
      targetCommunityTotalWeight * degree * this.resolution / (2 * M * M);
    };
    UndirectedLouvainIndex.prototype.deltaWithOwnCommunity = function(i2, degree, targetCommunityDegree, targetCommunity) {
      var M = this.M;
      var targetCommunityTotalWeight = this.totalWeights[targetCommunity];
      degree += this.loops[i2];
      return targetCommunityDegree / M - // NOTE: formula is a bit different here because targetCommunityDegree is passed without * 2
      (targetCommunityTotalWeight - degree) * degree * this.resolution / (2 * M * M);
    };
    UndirectedLouvainIndex.prototype.fastDelta = function(i2, degree, targetCommunityDegree, targetCommunity) {
      var M = this.M;
      var targetCommunityTotalWeight = this.totalWeights[targetCommunity];
      degree += this.loops[i2];
      return targetCommunityDegree - degree * targetCommunityTotalWeight * this.resolution / (2 * M);
    };
    UndirectedLouvainIndex.prototype.fastDeltaWithOwnCommunity = function(i2, degree, targetCommunityDegree, targetCommunity) {
      var M = this.M;
      var targetCommunityTotalWeight = this.totalWeights[targetCommunity];
      degree += this.loops[i2];
      return targetCommunityDegree - degree * (targetCommunityTotalWeight - degree) * this.resolution / (2 * M);
    };
    UndirectedLouvainIndex.prototype.bounds = function(i2) {
      return [this.starts[i2], this.starts[i2 + 1]];
    };
    UndirectedLouvainIndex.prototype.project = function() {
      var self2 = this;
      var projection = {};
      self2.nodes.slice(0, this.C).forEach(function(node, i2) {
        projection[node] = Array.from(
          self2.neighborhood.slice(self2.starts[i2], self2.starts[i2 + 1])
        ).map(function(j) {
          return self2.nodes[j];
        });
      });
      return projection;
    };
    UndirectedLouvainIndex.prototype.collect = function(level) {
      if (arguments.length < 1) level = this.level;
      var o = {};
      var mapping = this.keepDendrogram ? this.dendrogram[level] : this.mapping;
      var i2, l;
      for (i2 = 0, l = mapping.length; i2 < l; i2++) o[this.nodes[i2]] = mapping[i2];
      return o;
    };
    UndirectedLouvainIndex.prototype.assign = function(prop, level) {
      if (arguments.length < 2) level = this.level;
      var mapping = this.keepDendrogram ? this.dendrogram[level] : this.mapping;
      var i2, l;
      for (i2 = 0, l = mapping.length; i2 < l; i2++)
        this.graph.setNodeAttribute(this.nodes[i2], prop, mapping[i2]);
    };
    UndirectedLouvainIndex.prototype[INSPECT] = function() {
      var proxy2 = {};
      Object.defineProperty(proxy2, "constructor", {
        value: UndirectedLouvainIndex,
        enumerable: false
      });
      proxy2.C = this.C;
      proxy2.M = this.M;
      proxy2.E = this.E;
      proxy2.U = this.U;
      proxy2.resolution = this.resolution;
      proxy2.level = this.level;
      proxy2.nodes = this.nodes;
      proxy2.starts = this.starts.slice(0, proxy2.C + 1);
      var eTruncated = ["neighborhood", "weights"];
      var cTruncated = ["counts", "loops", "belongings", "totalWeights"];
      var self2 = this;
      eTruncated.forEach(function(key) {
        proxy2[key] = self2[key].slice(0, proxy2.E);
      });
      cTruncated.forEach(function(key) {
        proxy2[key] = self2[key].slice(0, proxy2.C);
      });
      proxy2.unused = this.unused.slice(0, this.U);
      if (this.keepDendrogram) proxy2.dendrogram = this.dendrogram;
      else proxy2.mapping = this.mapping;
      return proxy2;
    };
    function DirectedLouvainIndex(graph, options) {
      options = resolveDefaults(options, DEFAULTS2);
      var resolution = options.resolution;
      var getEdgeWeight = createEdgeWeightGetter(options.getEdgeWeight).fromEntry;
      var size = (graph.size - graph.selfLoopCount) * 2;
      var NeighborhoodPointerArray = typed.getPointerArray(size);
      var NodesPointerArray = typed.getPointerArray(graph.order + 1);
      var WeightsArray = options.getEdgeWeight ? Float64Array : typed.getPointerArray(graph.size * 2);
      this.C = graph.order;
      this.M = 0;
      this.E = size;
      this.U = 0;
      this.resolution = resolution;
      this.level = 0;
      this.graph = graph;
      this.nodes = new Array(graph.order);
      this.keepDendrogram = options.keepDendrogram;
      this.neighborhood = new NodesPointerArray(size);
      this.weights = new WeightsArray(size);
      this.loops = new WeightsArray(graph.order);
      this.starts = new NeighborhoodPointerArray(graph.order + 1);
      this.offsets = new NeighborhoodPointerArray(graph.order);
      this.belongings = new NodesPointerArray(graph.order);
      this.dendrogram = [];
      this.counts = new NodesPointerArray(graph.order);
      this.unused = new NodesPointerArray(graph.order);
      this.totalInWeights = new WeightsArray(graph.order);
      this.totalOutWeights = new WeightsArray(graph.order);
      var ids = {};
      var weight;
      var i2 = 0, n = 0;
      var self2 = this;
      graph.forEachNode(function(node) {
        self2.nodes[i2] = node;
        ids[node] = i2;
        n += graph.outDegreeWithoutSelfLoops(node);
        self2.starts[i2] = n;
        n += graph.inDegreeWithoutSelfLoops(node);
        self2.offsets[i2] = n;
        self2.belongings[i2] = i2;
        self2.counts[i2] = 1;
        i2++;
      });
      graph.forEachEdge(function(edge2, attr, source, target, sa, ta, u) {
        weight = getEdgeWeight(edge2, attr, source, target, sa, ta, u);
        source = ids[source];
        target = ids[target];
        self2.M += weight;
        if (source === target) {
          self2.loops[source] += weight;
          self2.totalInWeights[source] += weight;
          self2.totalOutWeights[source] += weight;
        } else {
          self2.totalOutWeights[source] += weight;
          self2.totalInWeights[target] += weight;
          var startSource = --self2.starts[source], startTarget = --self2.offsets[target];
          self2.neighborhood[startSource] = target;
          self2.neighborhood[startTarget] = source;
          self2.weights[startSource] = weight;
          self2.weights[startTarget] = weight;
        }
      });
      this.starts[i2] = this.E;
      if (this.keepDendrogram) this.dendrogram.push(this.belongings.slice());
      else this.mapping = this.belongings.slice();
    }
    DirectedLouvainIndex.prototype.bounds = UndirectedLouvainIndex.prototype.bounds;
    DirectedLouvainIndex.prototype.inBounds = function(i2) {
      return [this.offsets[i2], this.starts[i2 + 1]];
    };
    DirectedLouvainIndex.prototype.outBounds = function(i2) {
      return [this.starts[i2], this.offsets[i2]];
    };
    DirectedLouvainIndex.prototype.project = UndirectedLouvainIndex.prototype.project;
    DirectedLouvainIndex.prototype.projectIn = function() {
      var self2 = this;
      var projection = {};
      self2.nodes.slice(0, this.C).forEach(function(node, i2) {
        projection[node] = Array.from(
          self2.neighborhood.slice(self2.offsets[i2], self2.starts[i2 + 1])
        ).map(function(j) {
          return self2.nodes[j];
        });
      });
      return projection;
    };
    DirectedLouvainIndex.prototype.projectOut = function() {
      var self2 = this;
      var projection = {};
      self2.nodes.slice(0, this.C).forEach(function(node, i2) {
        projection[node] = Array.from(
          self2.neighborhood.slice(self2.starts[i2], self2.offsets[i2])
        ).map(function(j) {
          return self2.nodes[j];
        });
      });
      return projection;
    };
    DirectedLouvainIndex.prototype.isolate = function(i2, inDegree, outDegree) {
      var currentCommunity = this.belongings[i2];
      if (this.counts[currentCommunity] === 1) return currentCommunity;
      var newCommunity = this.unused[--this.U];
      var loops = this.loops[i2];
      this.totalInWeights[currentCommunity] -= inDegree + loops;
      this.totalInWeights[newCommunity] += inDegree + loops;
      this.totalOutWeights[currentCommunity] -= outDegree + loops;
      this.totalOutWeights[newCommunity] += outDegree + loops;
      this.belongings[i2] = newCommunity;
      this.counts[currentCommunity]--;
      this.counts[newCommunity]++;
      return newCommunity;
    };
    DirectedLouvainIndex.prototype.move = function(i2, inDegree, outDegree, targetCommunity) {
      var currentCommunity = this.belongings[i2], loops = this.loops[i2];
      this.totalInWeights[currentCommunity] -= inDegree + loops;
      this.totalInWeights[targetCommunity] += inDegree + loops;
      this.totalOutWeights[currentCommunity] -= outDegree + loops;
      this.totalOutWeights[targetCommunity] += outDegree + loops;
      this.belongings[i2] = targetCommunity;
      var nowEmpty = this.counts[currentCommunity]-- === 1;
      this.counts[targetCommunity]++;
      if (nowEmpty) this.unused[this.U++] = currentCommunity;
    };
    DirectedLouvainIndex.prototype.computeNodeInDegree = function(i2) {
      var o, l, weight;
      var inDegree = 0;
      for (o = this.offsets[i2], l = this.starts[i2 + 1]; o < l; o++) {
        weight = this.weights[o];
        inDegree += weight;
      }
      return inDegree;
    };
    DirectedLouvainIndex.prototype.computeNodeOutDegree = function(i2) {
      var o, l, weight;
      var outDegree = 0;
      for (o = this.starts[i2], l = this.offsets[i2]; o < l; o++) {
        weight = this.weights[o];
        outDegree += weight;
      }
      return outDegree;
    };
    DirectedLouvainIndex.prototype.expensiveMove = function(i2, ci) {
      var inDegree = this.computeNodeInDegree(i2), outDegree = this.computeNodeOutDegree(i2);
      this.move(i2, inDegree, outDegree, ci);
    };
    DirectedLouvainIndex.prototype.zoomOut = function() {
      var inducedGraph = new Array(this.C - this.U), newLabels = {};
      var N = this.nodes.length;
      var C2 = 0, E = 0;
      var i2, j, l, m, n, ci, cj, data, offset, out2, adj, inAdj, outAdj;
      for (i2 = 0, l = this.C; i2 < l; i2++) {
        ci = this.belongings[i2];
        if (!(ci in newLabels)) {
          newLabels[ci] = C2;
          inducedGraph[C2] = {
            inAdj: {},
            outAdj: {},
            totalInWeights: this.totalInWeights[ci],
            totalOutWeights: this.totalOutWeights[ci],
            internalWeights: 0
          };
          C2++;
        }
        this.belongings[i2] = newLabels[ci];
      }
      var currentLevel, nextLevel;
      if (this.keepDendrogram) {
        currentLevel = this.dendrogram[this.level];
        nextLevel = new (typed.getPointerArray(C2))(N);
        for (i2 = 0; i2 < N; i2++) nextLevel[i2] = this.belongings[currentLevel[i2]];
        this.dendrogram.push(nextLevel);
      } else {
        for (i2 = 0; i2 < N; i2++) this.mapping[i2] = this.belongings[this.mapping[i2]];
      }
      for (i2 = 0, l = this.C; i2 < l; i2++) {
        ci = this.belongings[i2];
        offset = this.offsets[i2];
        data = inducedGraph[ci];
        inAdj = data.inAdj;
        outAdj = data.outAdj;
        data.internalWeights += this.loops[i2];
        for (j = this.starts[i2], m = this.starts[i2 + 1]; j < m; j++) {
          n = this.neighborhood[j];
          cj = this.belongings[n];
          out2 = j < offset;
          adj = out2 ? outAdj : inAdj;
          if (ci === cj) {
            if (out2) data.internalWeights += this.weights[j];
            continue;
          }
          if (!(cj in adj)) adj[cj] = 0;
          adj[cj] += this.weights[j];
        }
      }
      this.C = C2;
      n = 0;
      for (ci = 0; ci < C2; ci++) {
        data = inducedGraph[ci];
        inAdj = data.inAdj;
        outAdj = data.outAdj;
        ci = +ci;
        this.totalInWeights[ci] = data.totalInWeights;
        this.totalOutWeights[ci] = data.totalOutWeights;
        this.loops[ci] = data.internalWeights;
        this.counts[ci] = 1;
        this.starts[ci] = n;
        this.belongings[ci] = ci;
        for (cj in outAdj) {
          this.neighborhood[n] = +cj;
          this.weights[n] = outAdj[cj];
          E++;
          n++;
        }
        this.offsets[ci] = n;
        for (cj in inAdj) {
          this.neighborhood[n] = +cj;
          this.weights[n] = inAdj[cj];
          E++;
          n++;
        }
      }
      this.starts[C2] = E;
      this.E = E;
      this.U = 0;
      this.level++;
      return newLabels;
    };
    DirectedLouvainIndex.prototype.modularity = function() {
      var ci, cj, i2, j, m;
      var Q = 0;
      var M = this.M;
      var internalWeights = new Float64Array(this.C);
      for (i2 = 0; i2 < this.C; i2++) {
        ci = this.belongings[i2];
        internalWeights[ci] += this.loops[i2];
        for (j = this.starts[i2], m = this.offsets[i2]; j < m; j++) {
          cj = this.belongings[this.neighborhood[j]];
          if (ci !== cj) continue;
          internalWeights[ci] += this.weights[j];
        }
      }
      for (i2 = 0; i2 < this.C; i2++)
        Q += internalWeights[i2] / M - this.totalInWeights[i2] * this.totalOutWeights[i2] / Math.pow(M, 2) * this.resolution;
      return Q;
    };
    DirectedLouvainIndex.prototype.delta = function(i2, inDegree, outDegree, targetCommunityDegree, targetCommunity) {
      var M = this.M;
      var targetCommunityTotalInWeight = this.totalInWeights[targetCommunity], targetCommunityTotalOutWeight = this.totalOutWeights[targetCommunity];
      var loops = this.loops[i2];
      inDegree += loops;
      outDegree += loops;
      return targetCommunityDegree / M - (outDegree * targetCommunityTotalInWeight + inDegree * targetCommunityTotalOutWeight) * this.resolution / (M * M);
    };
    DirectedLouvainIndex.prototype.deltaWithOwnCommunity = function(i2, inDegree, outDegree, targetCommunityDegree, targetCommunity) {
      var M = this.M;
      var targetCommunityTotalInWeight = this.totalInWeights[targetCommunity], targetCommunityTotalOutWeight = this.totalOutWeights[targetCommunity];
      var loops = this.loops[i2];
      inDegree += loops;
      outDegree += loops;
      return targetCommunityDegree / M - (outDegree * (targetCommunityTotalInWeight - inDegree) + inDegree * (targetCommunityTotalOutWeight - outDegree)) * this.resolution / (M * M);
    };
    DirectedLouvainIndex.prototype.collect = UndirectedLouvainIndex.prototype.collect;
    DirectedLouvainIndex.prototype.assign = UndirectedLouvainIndex.prototype.assign;
    DirectedLouvainIndex.prototype[INSPECT] = function() {
      var proxy2 = {};
      Object.defineProperty(proxy2, "constructor", {
        value: DirectedLouvainIndex,
        enumerable: false
      });
      proxy2.C = this.C;
      proxy2.M = this.M;
      proxy2.E = this.E;
      proxy2.U = this.U;
      proxy2.resolution = this.resolution;
      proxy2.level = this.level;
      proxy2.nodes = this.nodes;
      proxy2.starts = this.starts.slice(0, proxy2.C + 1);
      var eTruncated = ["neighborhood", "weights"];
      var cTruncated = [
        "counts",
        "offsets",
        "loops",
        "belongings",
        "totalInWeights",
        "totalOutWeights"
      ];
      var self2 = this;
      eTruncated.forEach(function(key) {
        proxy2[key] = self2[key].slice(0, proxy2.E);
      });
      cTruncated.forEach(function(key) {
        proxy2[key] = self2[key].slice(0, proxy2.C);
      });
      proxy2.unused = this.unused.slice(0, this.U);
      if (this.keepDendrogram) proxy2.dendrogram = this.dendrogram;
      else proxy2.mapping = this.mapping;
      return proxy2;
    };
    exports2.UndirectedLouvainIndex = UndirectedLouvainIndex;
    exports2.DirectedLouvainIndex = DirectedLouvainIndex;
  }
});

// node_modules/graphology-communities-louvain/index.js
var require_graphology_communities_louvain = __commonJS({
  "node_modules/graphology-communities-louvain/index.js"(exports2, module2) {
    var resolveDefaults = require_defaults();
    var isGraph = require_is_graph();
    var inferType = require_infer_type();
    var SparseMap = require_sparse_map();
    var SparseQueueSet = require_sparse_queue_set();
    var createRandomIndex = require_random_index().createRandomIndex;
    var indices = require_louvain();
    var UndirectedLouvainIndex = indices.UndirectedLouvainIndex;
    var DirectedLouvainIndex = indices.DirectedLouvainIndex;
    var DEFAULTS2 = {
      nodeCommunityAttribute: "community",
      getEdgeWeight: "weight",
      fastLocalMoves: true,
      randomWalk: true,
      resolution: 1,
      rng: Math.random
    };
    function addWeightToCommunity(map, community, weight) {
      var currentWeight = map.get(community);
      if (typeof currentWeight === "undefined") currentWeight = 0;
      currentWeight += weight;
      map.set(community, currentWeight);
    }
    var EPSILON = 1e-10;
    function tieBreaker(bestCommunity, currentCommunity, targetCommunity, delta, bestDelta) {
      if (Math.abs(delta - bestDelta) < EPSILON) {
        if (bestCommunity === currentCommunity) {
          return false;
        } else {
          return targetCommunity > bestCommunity;
        }
      } else if (delta > bestDelta) {
        return true;
      }
      return false;
    }
    function undirectedLouvain(detailed, graph, options) {
      var index = new UndirectedLouvainIndex(graph, {
        getEdgeWeight: options.getEdgeWeight,
        keepDendrogram: detailed,
        resolution: options.resolution
      });
      var randomIndex = createRandomIndex(options.rng);
      var moveWasMade = true, localMoveWasMade = true;
      var currentCommunity, targetCommunity;
      var communities = new SparseMap(Float64Array, index.C);
      var queue, start2, end, weight, ci, ri, s, i2, j, l;
      var degree, targetCommunityDegree;
      var bestCommunity, bestDelta, deltaIsBetter, delta;
      var deltaComputations = 0, nodesVisited = 0, moves = [], localMoves, currentMoves;
      if (options.fastLocalMoves) queue = new SparseQueueSet(index.C);
      while (moveWasMade) {
        l = index.C;
        moveWasMade = false;
        localMoveWasMade = true;
        if (options.fastLocalMoves) {
          currentMoves = 0;
          ri = options.randomWalk ? randomIndex(l) : 0;
          for (s = 0; s < l; s++, ri++) {
            i2 = ri % l;
            queue.enqueue(i2);
          }
          while (queue.size !== 0) {
            i2 = queue.dequeue();
            nodesVisited++;
            degree = 0;
            communities.clear();
            currentCommunity = index.belongings[i2];
            start2 = index.starts[i2];
            end = index.starts[i2 + 1];
            for (; start2 < end; start2++) {
              j = index.neighborhood[start2];
              weight = index.weights[start2];
              targetCommunity = index.belongings[j];
              degree += weight;
              addWeightToCommunity(communities, targetCommunity, weight);
            }
            bestDelta = index.fastDeltaWithOwnCommunity(
              i2,
              degree,
              communities.get(currentCommunity) || 0,
              currentCommunity
            );
            bestCommunity = currentCommunity;
            for (ci = 0; ci < communities.size; ci++) {
              targetCommunity = communities.dense[ci];
              if (targetCommunity === currentCommunity) continue;
              targetCommunityDegree = communities.vals[ci];
              deltaComputations++;
              delta = index.fastDelta(
                i2,
                degree,
                targetCommunityDegree,
                targetCommunity
              );
              deltaIsBetter = tieBreaker(
                bestCommunity,
                currentCommunity,
                targetCommunity,
                delta,
                bestDelta
              );
              if (deltaIsBetter) {
                bestDelta = delta;
                bestCommunity = targetCommunity;
              }
            }
            if (bestDelta < 0) {
              bestCommunity = index.isolate(i2, degree);
              if (bestCommunity === currentCommunity) continue;
            } else {
              if (bestCommunity === currentCommunity) {
                continue;
              } else {
                index.move(i2, degree, bestCommunity);
              }
            }
            moveWasMade = true;
            currentMoves++;
            start2 = index.starts[i2];
            end = index.starts[i2 + 1];
            for (; start2 < end; start2++) {
              j = index.neighborhood[start2];
              targetCommunity = index.belongings[j];
              if (targetCommunity !== bestCommunity) queue.enqueue(j);
            }
          }
          moves.push(currentMoves);
        } else {
          localMoves = [];
          moves.push(localMoves);
          while (localMoveWasMade) {
            localMoveWasMade = false;
            currentMoves = 0;
            ri = options.randomWalk ? randomIndex(l) : 0;
            for (s = 0; s < l; s++, ri++) {
              i2 = ri % l;
              nodesVisited++;
              degree = 0;
              communities.clear();
              currentCommunity = index.belongings[i2];
              start2 = index.starts[i2];
              end = index.starts[i2 + 1];
              for (; start2 < end; start2++) {
                j = index.neighborhood[start2];
                weight = index.weights[start2];
                targetCommunity = index.belongings[j];
                degree += weight;
                addWeightToCommunity(communities, targetCommunity, weight);
              }
              bestDelta = index.fastDeltaWithOwnCommunity(
                i2,
                degree,
                communities.get(currentCommunity) || 0,
                currentCommunity
              );
              bestCommunity = currentCommunity;
              for (ci = 0; ci < communities.size; ci++) {
                targetCommunity = communities.dense[ci];
                if (targetCommunity === currentCommunity) continue;
                targetCommunityDegree = communities.vals[ci];
                deltaComputations++;
                delta = index.fastDelta(
                  i2,
                  degree,
                  targetCommunityDegree,
                  targetCommunity
                );
                deltaIsBetter = tieBreaker(
                  bestCommunity,
                  currentCommunity,
                  targetCommunity,
                  delta,
                  bestDelta
                );
                if (deltaIsBetter) {
                  bestDelta = delta;
                  bestCommunity = targetCommunity;
                }
              }
              if (bestDelta < 0) {
                bestCommunity = index.isolate(i2, degree);
                if (bestCommunity === currentCommunity) continue;
              } else {
                if (bestCommunity === currentCommunity) {
                  continue;
                } else {
                  index.move(i2, degree, bestCommunity);
                }
              }
              localMoveWasMade = true;
              currentMoves++;
            }
            localMoves.push(currentMoves);
            moveWasMade = localMoveWasMade || moveWasMade;
          }
        }
        if (moveWasMade) index.zoomOut();
      }
      var results = {
        index,
        deltaComputations,
        nodesVisited,
        moves
      };
      return results;
    }
    function directedLouvain(detailed, graph, options) {
      var index = new DirectedLouvainIndex(graph, {
        getEdgeWeight: options.getEdgeWeight,
        keepDendrogram: detailed,
        resolution: options.resolution
      });
      var randomIndex = createRandomIndex(options.rng);
      var moveWasMade = true, localMoveWasMade = true;
      var currentCommunity, targetCommunity;
      var communities = new SparseMap(Float64Array, index.C);
      var queue, start2, end, offset, out2, weight, ci, ri, s, i2, j, l;
      var inDegree, outDegree, targetCommunityDegree;
      var bestCommunity, bestDelta, deltaIsBetter, delta;
      var deltaComputations = 0, nodesVisited = 0, moves = [], localMoves, currentMoves;
      if (options.fastLocalMoves) queue = new SparseQueueSet(index.C);
      while (moveWasMade) {
        l = index.C;
        moveWasMade = false;
        localMoveWasMade = true;
        if (options.fastLocalMoves) {
          currentMoves = 0;
          ri = options.randomWalk ? randomIndex(l) : 0;
          for (s = 0; s < l; s++, ri++) {
            i2 = ri % l;
            queue.enqueue(i2);
          }
          while (queue.size !== 0) {
            i2 = queue.dequeue();
            nodesVisited++;
            inDegree = 0;
            outDegree = 0;
            communities.clear();
            currentCommunity = index.belongings[i2];
            start2 = index.starts[i2];
            end = index.starts[i2 + 1];
            offset = index.offsets[i2];
            for (; start2 < end; start2++) {
              out2 = start2 < offset;
              j = index.neighborhood[start2];
              weight = index.weights[start2];
              targetCommunity = index.belongings[j];
              if (out2) outDegree += weight;
              else inDegree += weight;
              addWeightToCommunity(communities, targetCommunity, weight);
            }
            bestDelta = index.deltaWithOwnCommunity(
              i2,
              inDegree,
              outDegree,
              communities.get(currentCommunity) || 0,
              currentCommunity
            );
            bestCommunity = currentCommunity;
            for (ci = 0; ci < communities.size; ci++) {
              targetCommunity = communities.dense[ci];
              if (targetCommunity === currentCommunity) continue;
              targetCommunityDegree = communities.vals[ci];
              deltaComputations++;
              delta = index.delta(
                i2,
                inDegree,
                outDegree,
                targetCommunityDegree,
                targetCommunity
              );
              deltaIsBetter = tieBreaker(
                bestCommunity,
                currentCommunity,
                targetCommunity,
                delta,
                bestDelta
              );
              if (deltaIsBetter) {
                bestDelta = delta;
                bestCommunity = targetCommunity;
              }
            }
            if (bestDelta < 0) {
              bestCommunity = index.isolate(i2, inDegree, outDegree);
              if (bestCommunity === currentCommunity) continue;
            } else {
              if (bestCommunity === currentCommunity) {
                continue;
              } else {
                index.move(i2, inDegree, outDegree, bestCommunity);
              }
            }
            moveWasMade = true;
            currentMoves++;
            start2 = index.starts[i2];
            end = index.starts[i2 + 1];
            for (; start2 < end; start2++) {
              j = index.neighborhood[start2];
              targetCommunity = index.belongings[j];
              if (targetCommunity !== bestCommunity) queue.enqueue(j);
            }
          }
          moves.push(currentMoves);
        } else {
          localMoves = [];
          moves.push(localMoves);
          while (localMoveWasMade) {
            localMoveWasMade = false;
            currentMoves = 0;
            ri = options.randomWalk ? randomIndex(l) : 0;
            for (s = 0; s < l; s++, ri++) {
              i2 = ri % l;
              nodesVisited++;
              inDegree = 0;
              outDegree = 0;
              communities.clear();
              currentCommunity = index.belongings[i2];
              start2 = index.starts[i2];
              end = index.starts[i2 + 1];
              offset = index.offsets[i2];
              for (; start2 < end; start2++) {
                out2 = start2 < offset;
                j = index.neighborhood[start2];
                weight = index.weights[start2];
                targetCommunity = index.belongings[j];
                if (out2) outDegree += weight;
                else inDegree += weight;
                addWeightToCommunity(communities, targetCommunity, weight);
              }
              bestDelta = index.deltaWithOwnCommunity(
                i2,
                inDegree,
                outDegree,
                communities.get(currentCommunity) || 0,
                currentCommunity
              );
              bestCommunity = currentCommunity;
              for (ci = 0; ci < communities.size; ci++) {
                targetCommunity = communities.dense[ci];
                if (targetCommunity === currentCommunity) continue;
                targetCommunityDegree = communities.vals[ci];
                deltaComputations++;
                delta = index.delta(
                  i2,
                  inDegree,
                  outDegree,
                  targetCommunityDegree,
                  targetCommunity
                );
                deltaIsBetter = tieBreaker(
                  bestCommunity,
                  currentCommunity,
                  targetCommunity,
                  delta,
                  bestDelta
                );
                if (deltaIsBetter) {
                  bestDelta = delta;
                  bestCommunity = targetCommunity;
                }
              }
              if (bestDelta < 0) {
                bestCommunity = index.isolate(i2, inDegree, outDegree);
                if (bestCommunity === currentCommunity) continue;
              } else {
                if (bestCommunity === currentCommunity) {
                  continue;
                } else {
                  index.move(i2, inDegree, outDegree, bestCommunity);
                }
              }
              localMoveWasMade = true;
              currentMoves++;
            }
            localMoves.push(currentMoves);
            moveWasMade = localMoveWasMade || moveWasMade;
          }
        }
        if (moveWasMade) index.zoomOut();
      }
      var results = {
        index,
        deltaComputations,
        nodesVisited,
        moves
      };
      return results;
    }
    function louvain2(assign2, detailed, graph, options) {
      if (!isGraph(graph))
        throw new Error(
          "graphology-communities-louvain: the given graph is not a valid graphology instance."
        );
      var type = inferType(graph);
      if (type === "mixed")
        throw new Error(
          "graphology-communities-louvain: cannot run the algorithm on a true mixed graph."
        );
      options = resolveDefaults(options, DEFAULTS2);
      var c = 0;
      if (graph.size === 0) {
        if (assign2) {
          graph.forEachNode(function(node) {
            graph.setNodeAttribute(node, options.nodeCommunityAttribute, c++);
          });
          return;
        }
        var communities = {};
        graph.forEachNode(function(node) {
          communities[node] = c++;
        });
        if (!detailed) return communities;
        return {
          communities,
          count: graph.order,
          deltaComputations: 0,
          dendrogram: null,
          level: 0,
          modularity: NaN,
          moves: null,
          nodesVisited: 0,
          resolution: options.resolution
        };
      }
      var fn3 = type === "undirected" ? undirectedLouvain : directedLouvain;
      var results = fn3(detailed, graph, options);
      var index = results.index;
      if (!detailed) {
        if (assign2) {
          index.assign(options.nodeCommunityAttribute);
          return;
        }
        return index.collect();
      }
      var output = {
        count: index.C,
        deltaComputations: results.deltaComputations,
        dendrogram: index.dendrogram,
        level: index.level,
        modularity: index.modularity(),
        moves: results.moves,
        nodesVisited: results.nodesVisited,
        resolution: options.resolution
      };
      if (assign2) {
        index.assign(options.nodeCommunityAttribute);
        return output;
      }
      output.communities = index.collect();
      return output;
    }
    var fn2 = louvain2.bind(null, false, false);
    fn2.assign = louvain2.bind(null, true, false);
    fn2.detailed = louvain2.bind(null, false, true);
    fn2.defaults = DEFAULTS2;
    module2.exports = fn2;
  }
});

// node_modules/graphology-utils/add-node.js
var require_add_node = __commonJS({
  "node_modules/graphology-utils/add-node.js"(exports2) {
    exports2.copyNode = function(graph, key, attributes) {
      attributes = Object.assign({}, attributes);
      return graph.addNode(key, attributes);
    };
  }
});

// node_modules/graphology-utils/add-edge.js
var require_add_edge = __commonJS({
  "node_modules/graphology-utils/add-edge.js"(exports2) {
    exports2.addEdge = function addEdge2(graph, undirected, key, source, target, attributes) {
      if (undirected) {
        if (key === null || key === void 0)
          return graph.addUndirectedEdge(source, target, attributes);
        else return graph.addUndirectedEdgeWithKey(key, source, target, attributes);
      } else {
        if (key === null || key === void 0)
          return graph.addDirectedEdge(source, target, attributes);
        else return graph.addDirectedEdgeWithKey(key, source, target, attributes);
      }
    };
    exports2.copyEdge = function copyEdge(graph, undirected, key, source, target, attributes) {
      attributes = Object.assign({}, attributes);
      if (undirected) {
        if (key === null || key === void 0)
          return graph.addUndirectedEdge(source, target, attributes);
        else return graph.addUndirectedEdgeWithKey(key, source, target, attributes);
      } else {
        if (key === null || key === void 0)
          return graph.addDirectedEdge(source, target, attributes);
        else return graph.addDirectedEdgeWithKey(key, source, target, attributes);
      }
    };
    exports2.mergeEdge = function mergeEdge2(graph, undirected, key, source, target, attributes) {
      if (undirected) {
        if (key === null || key === void 0)
          return graph.mergeUndirectedEdge(source, target, attributes);
        else
          return graph.mergeUndirectedEdgeWithKey(key, source, target, attributes);
      } else {
        if (key === null || key === void 0)
          return graph.mergeDirectedEdge(source, target, attributes);
        else return graph.mergeDirectedEdgeWithKey(key, source, target, attributes);
      }
    };
    exports2.updateEdge = function updateEdge(graph, undirected, key, source, target, updater) {
      if (undirected) {
        if (key === null || key === void 0)
          return graph.updateUndirectedEdge(source, target, updater);
        else return graph.updateUndirectedEdgeWithKey(key, source, target, updater);
      } else {
        if (key === null || key === void 0)
          return graph.updateDirectedEdge(source, target, updater);
        else return graph.updateDirectedEdgeWithKey(key, source, target, updater);
      }
    };
  }
});

// node_modules/graphology-operators/disjoint-union.js
var require_disjoint_union = __commonJS({
  "node_modules/graphology-operators/disjoint-union.js"(exports2, module2) {
    var isGraph = require_is_graph();
    var copyNode = require_add_node().copyNode;
    var copyEdge = require_add_edge().copyEdge;
    module2.exports = function disjointUnion(G, H) {
      if (!isGraph(G) || !isGraph(H))
        throw new Error("graphology-operators/disjoint-union: invalid graph.");
      if (G.multi !== H.multi)
        throw new Error(
          "graphology-operators/disjoint-union: both graph should be simple or multi."
        );
      var R = G.nullCopy();
      R.mergeAttributes(G.getAttributes());
      var labelsG = {};
      var labelsH = {};
      var i2 = 0;
      G.forEachNode(function(key, attr) {
        labelsG[key] = i2;
        copyNode(R, i2, attr);
        i2++;
      });
      H.forEachNode(function(key, attr) {
        labelsH[key] = i2;
        copyNode(R, i2, attr);
        i2++;
      });
      i2 = 0;
      G.forEachEdge(function(key, attr, source, target, _s, _t, undirected) {
        copyEdge(
          R,
          undirected,
          i2++,
          labelsG[source],
          labelsG[target],
          target,
          attr
        );
      });
      H.forEachEdge(function(key, attr, source, target, _s, _t, undirected) {
        copyEdge(
          R,
          undirected,
          i2++,
          labelsH[source],
          labelsH[target],
          target,
          attr
        );
      });
      return R;
    };
  }
});

// node_modules/graphology-operators/reverse.js
var require_reverse = __commonJS({
  "node_modules/graphology-operators/reverse.js"(exports2, module2) {
    var isGraph = require_is_graph();
    var copyEdge = require_add_edge().copyEdge;
    module2.exports = function reverse(graph) {
      if (!isGraph(graph))
        throw new Error("graphology-operators/reverse: invalid graph.");
      var reversed = graph.emptyCopy();
      graph.forEachEdge(function(key, attr, source, target, _sa, _ta, undirected) {
        if (undirected) {
          copyEdge(reversed, true, key, source, target, attr);
        } else {
          copyEdge(reversed, false, key, target, source, attr);
        }
      });
      return reversed;
    };
  }
});

// node_modules/graphology-operators/subgraph.js
var require_subgraph = __commonJS({
  "node_modules/graphology-operators/subgraph.js"(exports2, module2) {
    var isGraph = require_is_graph();
    var copyNode = require_add_node().copyNode;
    var copyEdge = require_add_edge().copyEdge;
    module2.exports = function subgraph2(graph, nodes) {
      if (!isGraph(graph))
        throw new Error("graphology-operators/subgraph: invalid graph instance.");
      var S2 = graph.nullCopy();
      var filterNode = nodes;
      if (Array.isArray(nodes)) {
        if (nodes.length === 0) return S2;
        nodes = new Set(nodes);
      }
      if (nodes instanceof Set) {
        if (nodes.size === 0) return S2;
        filterNode = function(key) {
          return nodes.has(key);
        };
        var old = nodes;
        nodes = /* @__PURE__ */ new Set();
        old.forEach(function(node) {
          nodes.add("" + node);
        });
      }
      if (typeof filterNode !== "function")
        throw new Error(
          "graphology-operators/subgraph: invalid nodes. Expecting an array or a set or a filtering function."
        );
      if (typeof nodes === "function") {
        graph.forEachNode(function(key, attr) {
          if (!filterNode(key, attr)) return;
          copyNode(S2, key, attr);
        });
        if (S2.order === 0) return S2;
      } else {
        nodes.forEach(function(key) {
          if (!graph.hasNode(key))
            throw new Error(
              'graphology-operators/subgraph: the "' + key + '" node was not found in the graph.'
            );
          copyNode(S2, key, graph.getNodeAttributes(key));
        });
      }
      graph.forEachEdge(function(key, attr, source, target, sourceAttr, targetAttr, undirected) {
        if (!filterNode(source, sourceAttr)) return;
        if (target !== source && !filterNode(target, targetAttr)) return;
        copyEdge(S2, undirected, key, source, target, attr);
      });
      return S2;
    };
  }
});

// node_modules/graphology-operators/to-directed.js
var require_to_directed = __commonJS({
  "node_modules/graphology-operators/to-directed.js"(exports2, module2) {
    var isGraph = require_is_graph();
    var copyEdge = require_add_edge().copyEdge;
    module2.exports = function toDirected(graph, options) {
      if (!isGraph(graph))
        throw new Error(
          "graphology-operators/to-directed: expecting a valid graphology instance."
        );
      if (typeof options === "function") options = { mergeEdge: options };
      options = options || {};
      var mergeEdge2 = typeof options.mergeEdge === "function" ? options.mergeEdge : null;
      if (graph.type === "directed") return graph.copy();
      var directedGraph = graph.emptyCopy({ type: "directed" });
      graph.forEachDirectedEdge(function(edge2, attr, source, target) {
        copyEdge(directedGraph, false, edge2, source, target, attr);
      });
      graph.forEachUndirectedEdge(function(_, attr, source, target) {
        var existingOutEdge = !graph.multi && graph.type === "mixed" && directedGraph.edge(source, target);
        var existingInEdge = !graph.multi && graph.type === "mixed" && directedGraph.edge(target, source);
        if (existingOutEdge) {
          directedGraph.replaceEdgeAttributes(
            existingOutEdge,
            mergeEdge2(directedGraph.getEdgeAttributes(existingOutEdge), attr)
          );
        } else {
          copyEdge(directedGraph, false, null, source, target, attr);
        }
        if (source === target) return;
        if (existingInEdge) {
          directedGraph.replaceEdgeAttributes(
            existingInEdge,
            mergeEdge2(directedGraph.getEdgeAttributes(existingInEdge), attr)
          );
        } else {
          copyEdge(directedGraph, false, null, target, source, attr);
        }
      });
      return directedGraph;
    };
  }
});

// node_modules/graphology-operators/to-mixed.js
var require_to_mixed = __commonJS({
  "node_modules/graphology-operators/to-mixed.js"(exports2, module2) {
    var isGraph = require_is_graph();
    module2.exports = function toMixed(graph) {
      if (!isGraph(graph))
        throw new Error(
          "graphology-operators/to-mixed: expecting a valid graphology instance."
        );
      return graph.copy({ type: "mixed" });
    };
  }
});

// node_modules/graphology-operators/to-multi.js
var require_to_multi = __commonJS({
  "node_modules/graphology-operators/to-multi.js"(exports2, module2) {
    var isGraph = require_is_graph();
    module2.exports = function toMulti(graph) {
      if (!isGraph(graph))
        throw new Error(
          "graphology-operators/to-multi: expecting a valid graphology instance."
        );
      return graph.copy({ multi: true });
    };
  }
});

// node_modules/graphology-operators/to-simple.js
var require_to_simple = __commonJS({
  "node_modules/graphology-operators/to-simple.js"(exports2, module2) {
    var isGraph = require_is_graph();
    var copyEdge = require_add_edge().copyEdge;
    module2.exports = function toSimple(multiGraph, options) {
      if (!isGraph(multiGraph))
        throw new Error(
          "graphology-operators/to-simple: expecting a valid graphology instance."
        );
      if (typeof options === "function") options = { mergeEdge: options };
      options = options || {};
      var mergeEdge2 = typeof options.mergeEdge === "function" ? options.mergeEdge : null;
      if (!multiGraph.multi) return multiGraph.copy();
      var simpleGraph = multiGraph.emptyCopy({ multi: false });
      multiGraph.forEachEdge(function(edge2, attr, source, target, _sa, _ta, undirected) {
        var existingEdge = undirected ? simpleGraph.undirectedEdge(source, target) : simpleGraph.directedEdge(source, target);
        if (existingEdge) {
          if (mergeEdge2) {
            simpleGraph.replaceEdgeAttributes(
              existingEdge,
              mergeEdge2(simpleGraph.getEdgeAttributes(existingEdge), attr)
            );
          }
          return;
        }
        copyEdge(simpleGraph, undirected, edge2, source, target, attr);
      });
      return simpleGraph;
    };
  }
});

// node_modules/graphology-operators/to-undirected.js
var require_to_undirected = __commonJS({
  "node_modules/graphology-operators/to-undirected.js"(exports2, module2) {
    var isGraph = require_is_graph();
    var copyEdge = require_add_edge().copyEdge;
    module2.exports = function toUndirected(graph, options) {
      if (!isGraph(graph))
        throw new Error(
          "graphology-operators/to-undirected: expecting a valid graphology instance."
        );
      if (typeof options === "function") options = { mergeEdge: options };
      options = options || {};
      var mergeEdge2 = typeof options.mergeEdge === "function" ? options.mergeEdge : null;
      if (graph.type === "undirected") return graph.copy();
      var undirectedGraph = graph.emptyCopy({ type: "undirected" });
      graph.forEachUndirectedEdge(function(edge2, attr, source, target) {
        copyEdge(undirectedGraph, true, edge2, source, target, attr);
      });
      graph.forEachDirectedEdge(function(edge2, attr, source, target) {
        if (!graph.multi) {
          var existingEdge = undirectedGraph.edge(source, target);
          if (existingEdge) {
            if (mergeEdge2)
              undirectedGraph.replaceEdgeAttributes(
                existingEdge,
                mergeEdge2(undirectedGraph.getEdgeAttributes(existingEdge), attr)
              );
            return;
          }
        }
        copyEdge(undirectedGraph, true, null, source, target, attr);
      });
      return undirectedGraph;
    };
  }
});

// node_modules/graphology-operators/union.js
var require_union = __commonJS({
  "node_modules/graphology-operators/union.js"(exports2, module2) {
    var isGraph = require_is_graph();
    module2.exports = function union(G, H) {
      if (!isGraph(G) || !isGraph(H))
        throw new Error("graphology-operators/union: invalid graph.");
      if (G.multi !== H.multi)
        throw new Error(
          "graphology-operators/union: both graph should be simple or multi."
        );
      var R = G.copy();
      R.import(H, true);
      return R;
    };
  }
});

// node_modules/graphology-operators/index.js
var require_graphology_operators = __commonJS({
  "node_modules/graphology-operators/index.js"(exports2) {
    exports2.disjointUnion = require_disjoint_union();
    exports2.reverse = require_reverse();
    exports2.subgraph = require_subgraph();
    exports2.toDirected = require_to_directed();
    exports2.toMixed = require_to_mixed();
    exports2.toMulti = require_to_multi();
    exports2.toSimple = require_to_simple();
    exports2.toUndirected = require_to_undirected();
    exports2.union = require_union();
  }
});

// node_modules/web-tree-sitter/tree-sitter.js
var require_tree_sitter = __commonJS({
  "node_modules/web-tree-sitter/tree-sitter.js"(exports, module) {
    var Module = void 0 !== Module ? Module : {};
    var TreeSitter = (function() {
      var initPromise, document = "object" == typeof window ? { currentScript: window.document.currentScript } : null;
      class Parser {
        constructor() {
          this.initialize();
        }
        initialize() {
          throw new Error("cannot construct a Parser before calling `init()`");
        }
        static init(moduleOptions) {
          return initPromise || (Module = Object.assign({}, Module, moduleOptions), initPromise = new Promise(((resolveInitPromise) => {
            var moduleOverrides = Object.assign({}, Module), arguments_ = [], thisProgram = "./this.program", quit_ = (e, t) => {
              throw t;
            }, ENVIRONMENT_IS_WEB = "object" == typeof window, ENVIRONMENT_IS_WORKER = "function" == typeof importScripts, ENVIRONMENT_IS_NODE = "object" == typeof process && "object" == typeof process.versions && "string" == typeof process.versions.node, scriptDirectory = "", read_, readAsync, readBinary;
            function locateFile(e) {
              return Module.locateFile ? Module.locateFile(e, scriptDirectory) : scriptDirectory + e;
            }
            if (ENVIRONMENT_IS_NODE) {
              var fs = __require("fs"), nodePath = __require("path");
              scriptDirectory = ENVIRONMENT_IS_WORKER ? nodePath.dirname(scriptDirectory) + "/" : __dirname + "/", read_ = (e, t) => (e = isFileURI(e) ? new URL(e) : nodePath.normalize(e), fs.readFileSync(e, t ? void 0 : "utf8")), readBinary = (e) => {
                var t = read_(e, true);
                return t.buffer || (t = new Uint8Array(t)), t;
              }, readAsync = (e, t, _, s = true) => {
                e = isFileURI(e) ? new URL(e) : nodePath.normalize(e), fs.readFile(e, s ? void 0 : "utf8", ((e2, r) => {
                  e2 ? _(e2) : t(s ? r.buffer : r);
                }));
              }, !Module.thisProgram && process.argv.length > 1 && (thisProgram = process.argv[1].replace(/\\/g, "/")), arguments_ = process.argv.slice(2), "undefined" != typeof module && (module.exports = Module), quit_ = (e, t) => {
                throw process.exitCode = e, t;
              };
            } else (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && (ENVIRONMENT_IS_WORKER ? scriptDirectory = self.location.href : void 0 !== document && document.currentScript && (scriptDirectory = document.currentScript.src), scriptDirectory = scriptDirectory.startsWith("blob:") ? "" : scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1), read_ = (e) => {
              var t = new XMLHttpRequest();
              return t.open("GET", e, false), t.send(null), t.responseText;
            }, ENVIRONMENT_IS_WORKER && (readBinary = (e) => {
              var t = new XMLHttpRequest();
              return t.open("GET", e, false), t.responseType = "arraybuffer", t.send(null), new Uint8Array(t.response);
            }), readAsync = (e, t, _) => {
              var s = new XMLHttpRequest();
              s.open("GET", e, true), s.responseType = "arraybuffer", s.onload = () => {
                200 == s.status || 0 == s.status && s.response ? t(s.response) : _();
              }, s.onerror = _, s.send(null);
            });
            var out = Module.print || console.log.bind(console), err = Module.printErr || console.error.bind(console);
            Object.assign(Module, moduleOverrides), moduleOverrides = null, Module.arguments && (arguments_ = Module.arguments), Module.thisProgram && (thisProgram = Module.thisProgram), Module.quit && (quit_ = Module.quit);
            var dynamicLibraries = Module.dynamicLibraries || [], wasmBinary, wasmMemory;
            Module.wasmBinary && (wasmBinary = Module.wasmBinary), "object" != typeof WebAssembly && abort("no native wasm support detected");
            var ABORT = false, EXITSTATUS, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
            function updateMemoryViews() {
              var e = wasmMemory.buffer;
              Module.HEAP8 = HEAP8 = new Int8Array(e), Module.HEAP16 = HEAP16 = new Int16Array(e), Module.HEAPU8 = HEAPU8 = new Uint8Array(e), Module.HEAPU16 = HEAPU16 = new Uint16Array(e), Module.HEAP32 = HEAP32 = new Int32Array(e), Module.HEAPU32 = HEAPU32 = new Uint32Array(e), Module.HEAPF32 = HEAPF32 = new Float32Array(e), Module.HEAPF64 = HEAPF64 = new Float64Array(e);
            }
            var INITIAL_MEMORY = Module.INITIAL_MEMORY || 33554432;
            wasmMemory = Module.wasmMemory ? Module.wasmMemory : new WebAssembly.Memory({ initial: INITIAL_MEMORY / 65536, maximum: 32768 }), updateMemoryViews(), INITIAL_MEMORY = wasmMemory.buffer.byteLength;
            var __ATPRERUN__ = [], __ATINIT__ = [], __ATMAIN__ = [], __ATPOSTRUN__ = [], __RELOC_FUNCS__ = [], runtimeInitialized = false;
            function preRun() {
              if (Module.preRun) for ("function" == typeof Module.preRun && (Module.preRun = [Module.preRun]); Module.preRun.length; ) addOnPreRun(Module.preRun.shift());
              callRuntimeCallbacks(__ATPRERUN__);
            }
            function initRuntime() {
              runtimeInitialized = true, callRuntimeCallbacks(__RELOC_FUNCS__), callRuntimeCallbacks(__ATINIT__);
            }
            function preMain() {
              callRuntimeCallbacks(__ATMAIN__);
            }
            function postRun() {
              if (Module.postRun) for ("function" == typeof Module.postRun && (Module.postRun = [Module.postRun]); Module.postRun.length; ) addOnPostRun(Module.postRun.shift());
              callRuntimeCallbacks(__ATPOSTRUN__);
            }
            function addOnPreRun(e) {
              __ATPRERUN__.unshift(e);
            }
            function addOnInit(e) {
              __ATINIT__.unshift(e);
            }
            function addOnPostRun(e) {
              __ATPOSTRUN__.unshift(e);
            }
            var runDependencies = 0, runDependencyWatcher = null, dependenciesFulfilled = null;
            function getUniqueRunDependency(e) {
              return e;
            }
            function addRunDependency(e) {
              runDependencies++, Module.monitorRunDependencies?.(runDependencies);
            }
            function removeRunDependency(e) {
              if (runDependencies--, Module.monitorRunDependencies?.(runDependencies), 0 == runDependencies && (null !== runDependencyWatcher && (clearInterval(runDependencyWatcher), runDependencyWatcher = null), dependenciesFulfilled)) {
                var t = dependenciesFulfilled;
                dependenciesFulfilled = null, t();
              }
            }
            function abort(e) {
              throw Module.onAbort?.(e), err(e = "Aborted(" + e + ")"), ABORT = true, EXITSTATUS = 1, e += ". Build with -sASSERTIONS for more info.", new WebAssembly.RuntimeError(e);
            }
            var dataURIPrefix = "data:application/octet-stream;base64,", isDataURI = (e) => e.startsWith(dataURIPrefix), isFileURI = (e) => e.startsWith("file://"), wasmBinaryFile;
            function getBinarySync(e) {
              if (e == wasmBinaryFile && wasmBinary) return new Uint8Array(wasmBinary);
              if (readBinary) return readBinary(e);
              throw "both async and sync fetching of the wasm failed";
            }
            function getBinaryPromise(e) {
              if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
                if ("function" == typeof fetch && !isFileURI(e)) return fetch(e, { credentials: "same-origin" }).then(((t) => {
                  if (!t.ok) throw `failed to load wasm binary file at '${e}'`;
                  return t.arrayBuffer();
                })).catch((() => getBinarySync(e)));
                if (readAsync) return new Promise(((t, _) => {
                  readAsync(e, ((e2) => t(new Uint8Array(e2))), _);
                }));
              }
              return Promise.resolve().then((() => getBinarySync(e)));
            }
            function instantiateArrayBuffer(e, t, _) {
              return getBinaryPromise(e).then(((e2) => WebAssembly.instantiate(e2, t))).then(_, ((e2) => {
                err(`failed to asynchronously prepare wasm: ${e2}`), abort(e2);
              }));
            }
            function instantiateAsync(e, t, _, s) {
              return e || "function" != typeof WebAssembly.instantiateStreaming || isDataURI(t) || isFileURI(t) || ENVIRONMENT_IS_NODE || "function" != typeof fetch ? instantiateArrayBuffer(t, _, s) : fetch(t, { credentials: "same-origin" }).then(((e2) => WebAssembly.instantiateStreaming(e2, _).then(s, (function(e3) {
                return err(`wasm streaming compile failed: ${e3}`), err("falling back to ArrayBuffer instantiation"), instantiateArrayBuffer(t, _, s);
              }))));
            }
            function createWasm() {
              var e = { env: wasmImports, wasi_snapshot_preview1: wasmImports, "GOT.mem": new Proxy(wasmImports, GOTHandler), "GOT.func": new Proxy(wasmImports, GOTHandler) };
              function t(e2, t2) {
                wasmExports = e2.exports, wasmExports = relocateExports(wasmExports, 1024);
                var _ = getDylinkMetadata(t2);
                return _.neededDynlibs && (dynamicLibraries = _.neededDynlibs.concat(dynamicLibraries)), mergeLibSymbols(wasmExports, "main"), LDSO.init(), loadDylibs(), addOnInit(wasmExports.__wasm_call_ctors), __RELOC_FUNCS__.push(wasmExports.__wasm_apply_data_relocs), removeRunDependency("wasm-instantiate"), wasmExports;
              }
              if (addRunDependency("wasm-instantiate"), Module.instantiateWasm) try {
                return Module.instantiateWasm(e, t);
              } catch (e2) {
                return err(`Module.instantiateWasm callback failed with error: ${e2}`), false;
              }
              return instantiateAsync(wasmBinary, wasmBinaryFile, e, (function(e2) {
                t(e2.instance, e2.module);
              })), {};
            }
            wasmBinaryFile = "tree-sitter.wasm", isDataURI(wasmBinaryFile) || (wasmBinaryFile = locateFile(wasmBinaryFile));
            var ASM_CONSTS = {};
            function ExitStatus(e) {
              this.name = "ExitStatus", this.message = `Program terminated with exit(${e})`, this.status = e;
            }
            var GOT = {}, currentModuleWeakSymbols = /* @__PURE__ */ new Set([]), GOTHandler = { get(e, t) {
              var _ = GOT[t];
              return _ || (_ = GOT[t] = new WebAssembly.Global({ value: "i32", mutable: true })), currentModuleWeakSymbols.has(t) || (_.required = true), _;
            } }, callRuntimeCallbacks = (e) => {
              for (; e.length > 0; ) e.shift()(Module);
            }, UTF8Decoder = "undefined" != typeof TextDecoder ? new TextDecoder("utf8") : void 0, UTF8ArrayToString = (e, t, _) => {
              for (var s = t + _, r = t; e[r] && !(r >= s); ) ++r;
              if (r - t > 16 && e.buffer && UTF8Decoder) return UTF8Decoder.decode(e.subarray(t, r));
              for (var a = ""; t < r; ) {
                var o = e[t++];
                if (128 & o) {
                  var n = 63 & e[t++];
                  if (192 != (224 & o)) {
                    var l = 63 & e[t++];
                    if ((o = 224 == (240 & o) ? (15 & o) << 12 | n << 6 | l : (7 & o) << 18 | n << 12 | l << 6 | 63 & e[t++]) < 65536) a += String.fromCharCode(o);
                    else {
                      var d = o - 65536;
                      a += String.fromCharCode(55296 | d >> 10, 56320 | 1023 & d);
                    }
                  } else a += String.fromCharCode((31 & o) << 6 | n);
                } else a += String.fromCharCode(o);
              }
              return a;
            }, getDylinkMetadata = (e) => {
              var t = 0, _ = 0;
              function s() {
                for (var _2 = 0, s2 = 1; ; ) {
                  var r2 = e[t++];
                  if (_2 += (127 & r2) * s2, s2 *= 128, !(128 & r2)) break;
                }
                return _2;
              }
              function r() {
                var _2 = s();
                return UTF8ArrayToString(e, (t += _2) - _2, _2);
              }
              function a(e2, t2) {
                if (e2) throw new Error(t2);
              }
              var o = "dylink.0";
              if (e instanceof WebAssembly.Module) {
                var n = WebAssembly.Module.customSections(e, o);
                0 === n.length && (o = "dylink", n = WebAssembly.Module.customSections(e, o)), a(0 === n.length, "need dylink section"), _ = (e = new Uint8Array(n[0])).length;
              } else {
                a(!(1836278016 == new Uint32Array(new Uint8Array(e.subarray(0, 24)).buffer)[0]), "need to see wasm magic number"), a(0 !== e[8], "need the dylink section to be first"), t = 9;
                var l = s();
                _ = t + l, o = r();
              }
              var d = { neededDynlibs: [], tlsExports: /* @__PURE__ */ new Set(), weakImports: /* @__PURE__ */ new Set() };
              if ("dylink" == o) {
                d.memorySize = s(), d.memoryAlign = s(), d.tableSize = s(), d.tableAlign = s();
                for (var u = s(), m = 0; m < u; ++m) {
                  var c = r();
                  d.neededDynlibs.push(c);
                }
              } else {
                a("dylink.0" !== o);
                for (; t < _; ) {
                  var w = e[t++], p = s();
                  if (1 === w) d.memorySize = s(), d.memoryAlign = s(), d.tableSize = s(), d.tableAlign = s();
                  else if (2 === w) for (u = s(), m = 0; m < u; ++m) c = r(), d.neededDynlibs.push(c);
                  else if (3 === w) for (var h = s(); h--; ) {
                    var g = r();
                    256 & s() && d.tlsExports.add(g);
                  }
                  else if (4 === w) for (h = s(); h--; ) {
                    r(), g = r();
                    1 == (3 & s()) && d.weakImports.add(g);
                  }
                  else t += p;
                }
              }
              return d;
            };
            function getValue(e, t = "i8") {
              switch (t.endsWith("*") && (t = "*"), t) {
                case "i1":
                case "i8":
                  return HEAP8[e];
                case "i16":
                  return HEAP16[e >> 1];
                case "i32":
                  return HEAP32[e >> 2];
                case "i64":
                  abort("to do getValue(i64) use WASM_BIGINT");
                case "float":
                  return HEAPF32[e >> 2];
                case "double":
                  return HEAPF64[e >> 3];
                case "*":
                  return HEAPU32[e >> 2];
                default:
                  abort(`invalid type for getValue: ${t}`);
              }
            }
            var newDSO = (e, t, _) => {
              var s = { refcount: 1 / 0, name: e, exports: _, global: true };
              return LDSO.loadedLibsByName[e] = s, null != t && (LDSO.loadedLibsByHandle[t] = s), s;
            }, LDSO = { loadedLibsByName: {}, loadedLibsByHandle: {}, init() {
              newDSO("__main__", 0, wasmImports);
            } }, ___heap_base = 78096, zeroMemory = (e, t) => (HEAPU8.fill(0, e, e + t), e), alignMemory = (e, t) => Math.ceil(e / t) * t, getMemory = (e) => {
              if (runtimeInitialized) return zeroMemory(_malloc(e), e);
              var t = ___heap_base, _ = t + alignMemory(e, 16);
              return ___heap_base = _, GOT.__heap_base.value = _, t;
            }, isInternalSym = (e) => ["__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm", "__start_em_js", "__stop_em_js"].includes(e) || e.startsWith("__em_js__"), uleb128Encode = (e, t) => {
              e < 128 ? t.push(e) : t.push(e % 128 | 128, e >> 7);
            }, sigToWasmTypes = (e) => {
              for (var t = { i: "i32", j: "i64", f: "f32", d: "f64", e: "externref", p: "i32" }, _ = { parameters: [], results: "v" == e[0] ? [] : [t[e[0]]] }, s = 1; s < e.length; ++s) _.parameters.push(t[e[s]]);
              return _;
            }, generateFuncType = (e, t) => {
              var _ = e.slice(0, 1), s = e.slice(1), r = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 };
              t.push(96), uleb128Encode(s.length, t);
              for (var a = 0; a < s.length; ++a) t.push(r[s[a]]);
              "v" == _ ? t.push(0) : t.push(1, r[_]);
            }, convertJsFunctionToWasm = (e, t) => {
              if ("function" == typeof WebAssembly.Function) return new WebAssembly.Function(sigToWasmTypes(t), e);
              var _ = [1];
              generateFuncType(t, _);
              var s = [0, 97, 115, 109, 1, 0, 0, 0, 1];
              uleb128Encode(_.length, s), s.push(..._), s.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
              var r = new WebAssembly.Module(new Uint8Array(s));
              return new WebAssembly.Instance(r, { e: { f: e } }).exports.f;
            }, wasmTableMirror = [], wasmTable = new WebAssembly.Table({ initial: 27, element: "anyfunc" }), getWasmTableEntry = (e) => {
              var t = wasmTableMirror[e];
              return t || (e >= wasmTableMirror.length && (wasmTableMirror.length = e + 1), wasmTableMirror[e] = t = wasmTable.get(e)), t;
            }, updateTableMap = (e, t) => {
              if (functionsInTableMap) for (var _ = e; _ < e + t; _++) {
                var s = getWasmTableEntry(_);
                s && functionsInTableMap.set(s, _);
              }
            }, functionsInTableMap, getFunctionAddress = (e) => (functionsInTableMap || (functionsInTableMap = /* @__PURE__ */ new WeakMap(), updateTableMap(0, wasmTable.length)), functionsInTableMap.get(e) || 0), freeTableIndexes = [], getEmptyTableSlot = () => {
              if (freeTableIndexes.length) return freeTableIndexes.pop();
              try {
                wasmTable.grow(1);
              } catch (e) {
                if (!(e instanceof RangeError)) throw e;
                throw "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.";
              }
              return wasmTable.length - 1;
            }, setWasmTableEntry = (e, t) => {
              wasmTable.set(e, t), wasmTableMirror[e] = wasmTable.get(e);
            }, addFunction = (e, t) => {
              var _ = getFunctionAddress(e);
              if (_) return _;
              var s = getEmptyTableSlot();
              try {
                setWasmTableEntry(s, e);
              } catch (_2) {
                if (!(_2 instanceof TypeError)) throw _2;
                var r = convertJsFunctionToWasm(e, t);
                setWasmTableEntry(s, r);
              }
              return functionsInTableMap.set(e, s), s;
            }, updateGOT = (e, t) => {
              for (var _ in e) if (!isInternalSym(_)) {
                var s = e[_];
                _.startsWith("orig$") && (_ = _.split("$")[1], t = true), GOT[_] ||= new WebAssembly.Global({ value: "i32", mutable: true }), (t || 0 == GOT[_].value) && ("function" == typeof s ? GOT[_].value = addFunction(s) : "number" == typeof s ? GOT[_].value = s : err(`unhandled export type for '${_}': ${typeof s}`));
              }
            }, relocateExports = (e, t, _) => {
              var s = {};
              for (var r in e) {
                var a = e[r];
                "object" == typeof a && (a = a.value), "number" == typeof a && (a += t), s[r] = a;
              }
              return updateGOT(s, _), s;
            }, isSymbolDefined = (e) => {
              var t = wasmImports[e];
              return !(!t || t.stub);
            }, dynCallLegacy = (e, t, _) => (0, Module["dynCall_" + e])(t, ..._), dynCall = (e, t, _ = []) => e.includes("j") ? dynCallLegacy(e, t, _) : getWasmTableEntry(t)(..._), createInvokeFunction = (e) => function() {
              var t = stackSave();
              try {
                return dynCall(e, arguments[0], Array.prototype.slice.call(arguments, 1));
              } catch (e2) {
                if (stackRestore(t), e2 !== e2 + 0) throw e2;
                _setThrew(1, 0);
              }
            }, resolveGlobalSymbol = (e, t = false) => {
              var _;
              return t && "orig$" + e in wasmImports && (e = "orig$" + e), isSymbolDefined(e) ? _ = wasmImports[e] : e.startsWith("invoke_") && (_ = wasmImports[e] = createInvokeFunction(e.split("_")[1])), { sym: _, name: e };
            }, UTF8ToString = (e, t) => e ? UTF8ArrayToString(HEAPU8, e, t) : "", loadWebAssemblyModule = (binary, flags, libName, localScope, handle) => {
              var metadata = getDylinkMetadata(binary);
              function loadModule() {
                var firstLoad = !handle || !HEAP8[handle + 8];
                if (firstLoad) {
                  var memAlign = Math.pow(2, metadata.memoryAlign), memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0, tableBase = metadata.tableSize ? wasmTable.length : 0;
                  handle && (HEAP8[handle + 8] = 1, HEAPU32[handle + 12 >> 2] = memoryBase, HEAP32[handle + 16 >> 2] = metadata.memorySize, HEAPU32[handle + 20 >> 2] = tableBase, HEAP32[handle + 24 >> 2] = metadata.tableSize);
                } else memoryBase = HEAPU32[handle + 12 >> 2], tableBase = HEAPU32[handle + 20 >> 2];
                var tableGrowthNeeded = tableBase + metadata.tableSize - wasmTable.length, moduleExports;
                function resolveSymbol(e) {
                  var t = resolveGlobalSymbol(e).sym;
                  return !t && localScope && (t = localScope[e]), t || (t = moduleExports[e]), t;
                }
                tableGrowthNeeded > 0 && wasmTable.grow(tableGrowthNeeded);
                var proxyHandler = { get(e, t) {
                  switch (t) {
                    case "__memory_base":
                      return memoryBase;
                    case "__table_base":
                      return tableBase;
                  }
                  if (t in wasmImports && !wasmImports[t].stub) return wasmImports[t];
                  var _;
                  t in e || (e[t] = (...e2) => (_ ||= resolveSymbol(t), _(...e2)));
                  return e[t];
                } }, proxy = new Proxy({}, proxyHandler), info = { "GOT.mem": new Proxy({}, GOTHandler), "GOT.func": new Proxy({}, GOTHandler), env: proxy, wasi_snapshot_preview1: proxy };
                function postInstantiation(module, instance) {
                  function addEmAsm(addr, body) {
                    for (var args = [], arity = 0; arity < 16 && -1 != body.indexOf("$" + arity); arity++) args.push("$" + arity);
                    args = args.join(",");
                    var func = `(${args}) => { ${body} };`;
                    ASM_CONSTS[start] = eval(func);
                  }
                  if (updateTableMap(tableBase, metadata.tableSize), moduleExports = relocateExports(instance.exports, memoryBase), flags.allowUndefined || reportUndefinedSymbols(), "__start_em_asm" in moduleExports) for (var start = moduleExports.__start_em_asm, stop = moduleExports.__stop_em_asm; start < stop; ) {
                    var jsString = UTF8ToString(start);
                    addEmAsm(start, jsString), start = HEAPU8.indexOf(0, start) + 1;
                  }
                  function addEmJs(name, cSig, body) {
                    var jsArgs = [];
                    if (cSig = cSig.slice(1, -1), "void" != cSig) for (var i in cSig = cSig.split(","), cSig) {
                      var jsArg = cSig[i].split(" ").pop();
                      jsArgs.push(jsArg.replace("*", ""));
                    }
                    var func = `(${jsArgs}) => ${body};`;
                    moduleExports[name] = eval(func);
                  }
                  for (var name in moduleExports) if (name.startsWith("__em_js__")) {
                    var start = moduleExports[name], jsString = UTF8ToString(start), parts = jsString.split("<::>");
                    addEmJs(name.replace("__em_js__", ""), parts[0], parts[1]), delete moduleExports[name];
                  }
                  var applyRelocs = moduleExports.__wasm_apply_data_relocs;
                  applyRelocs && (runtimeInitialized ? applyRelocs() : __RELOC_FUNCS__.push(applyRelocs));
                  var init = moduleExports.__wasm_call_ctors;
                  return init && (runtimeInitialized ? init() : __ATINIT__.push(init)), moduleExports;
                }
                if (flags.loadAsync) {
                  if (binary instanceof WebAssembly.Module) {
                    var instance = new WebAssembly.Instance(binary, info);
                    return Promise.resolve(postInstantiation(binary, instance));
                  }
                  return WebAssembly.instantiate(binary, info).then(((e) => postInstantiation(e.module, e.instance)));
                }
                var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary), instance = new WebAssembly.Instance(module, info);
                return postInstantiation(module, instance);
              }
              return currentModuleWeakSymbols = metadata.weakImports, flags.loadAsync ? metadata.neededDynlibs.reduce(((e, t) => e.then((() => loadDynamicLibrary(t, flags)))), Promise.resolve()).then(loadModule) : (metadata.neededDynlibs.forEach(((e) => loadDynamicLibrary(e, flags, localScope))), loadModule());
            }, mergeLibSymbols = (e, t) => {
              for (var [_, s] of Object.entries(e)) {
                const e2 = (e3) => {
                  isSymbolDefined(e3) || (wasmImports[e3] = s);
                };
                e2(_);
                const t2 = "__main_argc_argv";
                "main" == _ && e2(t2), _ == t2 && e2("main"), _.startsWith("dynCall_") && !Module.hasOwnProperty(_) && (Module[_] = s);
              }
            }, asyncLoad = (e, t, _, s) => {
              var r = s ? "" : getUniqueRunDependency(`al ${e}`);
              readAsync(e, ((e2) => {
                t(new Uint8Array(e2)), r && removeRunDependency(r);
              }), ((t2) => {
                if (!_) throw `Loading data file "${e}" failed.`;
                _();
              })), r && addRunDependency(r);
            };
            function loadDynamicLibrary(e, t = { global: true, nodelete: true }, _, s) {
              var r = LDSO.loadedLibsByName[e];
              if (r) return t.global ? r.global || (r.global = true, mergeLibSymbols(r.exports, e)) : _ && Object.assign(_, r.exports), t.nodelete && r.refcount !== 1 / 0 && (r.refcount = 1 / 0), r.refcount++, s && (LDSO.loadedLibsByHandle[s] = r), !t.loadAsync || Promise.resolve(true);
              function a() {
                if (s) {
                  var _2 = HEAPU32[s + 28 >> 2], r2 = HEAPU32[s + 32 >> 2];
                  if (_2 && r2) {
                    var a2 = HEAP8.slice(_2, _2 + r2);
                    return t.loadAsync ? Promise.resolve(a2) : a2;
                  }
                }
                var o2 = locateFile(e);
                if (t.loadAsync) return new Promise((function(e2, t2) {
                  asyncLoad(o2, e2, t2);
                }));
                if (!readBinary) throw new Error(`${o2}: file not found, and synchronous loading of external files is not available`);
                return readBinary(o2);
              }
              function o() {
                return t.loadAsync ? a().then(((r2) => loadWebAssemblyModule(r2, t, e, _, s))) : loadWebAssemblyModule(a(), t, e, _, s);
              }
              function n(t2) {
                r.global ? mergeLibSymbols(t2, e) : _ && Object.assign(_, t2), r.exports = t2;
              }
              return (r = newDSO(e, s, "loading")).refcount = t.nodelete ? 1 / 0 : 1, r.global = t.global, t.loadAsync ? o().then(((e2) => (n(e2), true))) : (n(o()), true);
            }
            var reportUndefinedSymbols = () => {
              for (var [e, t] of Object.entries(GOT)) if (0 == t.value) {
                var _ = resolveGlobalSymbol(e, true).sym;
                if (!_ && !t.required) continue;
                if ("function" == typeof _) t.value = addFunction(_, _.sig);
                else {
                  if ("number" != typeof _) throw new Error(`bad export type for '${e}': ${typeof _}`);
                  t.value = _;
                }
              }
            }, loadDylibs = () => {
              dynamicLibraries.length ? (addRunDependency("loadDylibs"), dynamicLibraries.reduce(((e, t) => e.then((() => loadDynamicLibrary(t, { loadAsync: true, global: true, nodelete: true, allowUndefined: true })))), Promise.resolve()).then((() => {
                reportUndefinedSymbols(), removeRunDependency("loadDylibs");
              }))) : reportUndefinedSymbols();
            }, noExitRuntime = Module.noExitRuntime || true;
            function setValue(e, t, _ = "i8") {
              switch (_.endsWith("*") && (_ = "*"), _) {
                case "i1":
                case "i8":
                  HEAP8[e] = t;
                  break;
                case "i16":
                  HEAP16[e >> 1] = t;
                  break;
                case "i32":
                  HEAP32[e >> 2] = t;
                  break;
                case "i64":
                  abort("to do setValue(i64) use WASM_BIGINT");
                case "float":
                  HEAPF32[e >> 2] = t;
                  break;
                case "double":
                  HEAPF64[e >> 3] = t;
                  break;
                case "*":
                  HEAPU32[e >> 2] = t;
                  break;
                default:
                  abort(`invalid type for setValue: ${_}`);
              }
            }
            var ___memory_base = new WebAssembly.Global({ value: "i32", mutable: false }, 1024), ___stack_pointer = new WebAssembly.Global({ value: "i32", mutable: true }, 78096), ___table_base = new WebAssembly.Global({ value: "i32", mutable: false }, 1), nowIsMonotonic = 1, __emscripten_get_now_is_monotonic = () => nowIsMonotonic;
            __emscripten_get_now_is_monotonic.sig = "i";
            var _abort = () => {
              abort("");
            };
            _abort.sig = "v";
            var _emscripten_date_now = () => Date.now(), _emscripten_get_now;
            _emscripten_date_now.sig = "d", _emscripten_get_now = () => performance.now(), _emscripten_get_now.sig = "d";
            var _emscripten_memcpy_js = (e, t, _) => HEAPU8.copyWithin(e, t, t + _);
            _emscripten_memcpy_js.sig = "vppp";
            var getHeapMax = () => 2147483648, growMemory = (e) => {
              var t = (e - wasmMemory.buffer.byteLength + 65535) / 65536;
              try {
                return wasmMemory.grow(t), updateMemoryViews(), 1;
              } catch (e2) {
              }
            }, _emscripten_resize_heap = (e) => {
              var t = HEAPU8.length;
              e >>>= 0;
              var _ = getHeapMax();
              if (e > _) return false;
              for (var s, r, a = 1; a <= 4; a *= 2) {
                var o = t * (1 + 0.2 / a);
                o = Math.min(o, e + 100663296);
                var n = Math.min(_, (s = Math.max(e, o)) + ((r = 65536) - s % r) % r);
                if (growMemory(n)) return true;
              }
              return false;
            };
            _emscripten_resize_heap.sig = "ip";
            var _fd_close = (e) => 52;
            _fd_close.sig = "ii";
            var convertI32PairToI53Checked = (e, t) => t + 2097152 >>> 0 < 4194305 - !!e ? (e >>> 0) + 4294967296 * t : NaN;
            function _fd_seek(e, t, _, s, r) {
              convertI32PairToI53Checked(t, _);
              return 70;
            }
            _fd_seek.sig = "iiiiip";
            var printCharBuffers = [null, [], []], printChar = (e, t) => {
              var _ = printCharBuffers[e];
              0 === t || 10 === t ? ((1 === e ? out : err)(UTF8ArrayToString(_, 0)), _.length = 0) : _.push(t);
            }, SYSCALLS = { varargs: void 0, get() {
              var e = HEAP32[+SYSCALLS.varargs >> 2];
              return SYSCALLS.varargs += 4, e;
            }, getp: () => SYSCALLS.get(), getStr: (e) => UTF8ToString(e) }, _fd_write = (e, t, _, s) => {
              for (var r = 0, a = 0; a < _; a++) {
                var o = HEAPU32[t >> 2], n = HEAPU32[t + 4 >> 2];
                t += 8;
                for (var l = 0; l < n; l++) printChar(e, HEAPU8[o + l]);
                r += n;
              }
              return HEAPU32[s >> 2] = r, 0;
            };
            function _tree_sitter_log_callback(e, t) {
              if (currentLogCallback) {
                const _ = UTF8ToString(t);
                currentLogCallback(_, 0 !== e);
              }
            }
            function _tree_sitter_parse_callback(e, t, _, s, r) {
              const a = currentParseCallback(t, { row: _, column: s });
              "string" == typeof a ? (setValue(r, a.length, "i32"), stringToUTF16(a, e, 10240)) : setValue(r, 0, "i32");
            }
            _fd_write.sig = "iippp";
            var runtimeKeepaliveCounter = 0, keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0, _proc_exit = (e) => {
              EXITSTATUS = e, keepRuntimeAlive() || (Module.onExit?.(e), ABORT = true), quit_(e, new ExitStatus(e));
            };
            _proc_exit.sig = "vi";
            var exitJS = (e, t) => {
              EXITSTATUS = e, _proc_exit(e);
            }, handleException = (e) => {
              if (e instanceof ExitStatus || "unwind" == e) return EXITSTATUS;
              quit_(1, e);
            }, lengthBytesUTF8 = (e) => {
              for (var t = 0, _ = 0; _ < e.length; ++_) {
                var s = e.charCodeAt(_);
                s <= 127 ? t++ : s <= 2047 ? t += 2 : s >= 55296 && s <= 57343 ? (t += 4, ++_) : t += 3;
              }
              return t;
            }, stringToUTF8Array = (e, t, _, s) => {
              if (!(s > 0)) return 0;
              for (var r = _, a = _ + s - 1, o = 0; o < e.length; ++o) {
                var n = e.charCodeAt(o);
                if (n >= 55296 && n <= 57343) n = 65536 + ((1023 & n) << 10) | 1023 & e.charCodeAt(++o);
                if (n <= 127) {
                  if (_ >= a) break;
                  t[_++] = n;
                } else if (n <= 2047) {
                  if (_ + 1 >= a) break;
                  t[_++] = 192 | n >> 6, t[_++] = 128 | 63 & n;
                } else if (n <= 65535) {
                  if (_ + 2 >= a) break;
                  t[_++] = 224 | n >> 12, t[_++] = 128 | n >> 6 & 63, t[_++] = 128 | 63 & n;
                } else {
                  if (_ + 3 >= a) break;
                  t[_++] = 240 | n >> 18, t[_++] = 128 | n >> 12 & 63, t[_++] = 128 | n >> 6 & 63, t[_++] = 128 | 63 & n;
                }
              }
              return t[_] = 0, _ - r;
            }, stringToUTF8 = (e, t, _) => stringToUTF8Array(e, HEAPU8, t, _), stringToUTF8OnStack = (e) => {
              var t = lengthBytesUTF8(e) + 1, _ = stackAlloc(t);
              return stringToUTF8(e, _, t), _;
            }, stringToUTF16 = (e, t, _) => {
              if (_ ??= 2147483647, _ < 2) return 0;
              for (var s = t, r = (_ -= 2) < 2 * e.length ? _ / 2 : e.length, a = 0; a < r; ++a) {
                var o = e.charCodeAt(a);
                HEAP16[t >> 1] = o, t += 2;
              }
              return HEAP16[t >> 1] = 0, t - s;
            }, AsciiToString = (e) => {
              for (var t = ""; ; ) {
                var _ = HEAPU8[e++];
                if (!_) return t;
                t += String.fromCharCode(_);
              }
            }, wasmImports = { __heap_base: ___heap_base, __indirect_function_table: wasmTable, __memory_base: ___memory_base, __stack_pointer: ___stack_pointer, __table_base: ___table_base, _emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic, abort: _abort, emscripten_get_now: _emscripten_get_now, emscripten_memcpy_js: _emscripten_memcpy_js, emscripten_resize_heap: _emscripten_resize_heap, fd_close: _fd_close, fd_seek: _fd_seek, fd_write: _fd_write, memory: wasmMemory, tree_sitter_log_callback: _tree_sitter_log_callback, tree_sitter_parse_callback: _tree_sitter_parse_callback }, wasmExports = createWasm(), ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports.__wasm_call_ctors)(), ___wasm_apply_data_relocs = () => (___wasm_apply_data_relocs = wasmExports.__wasm_apply_data_relocs)(), _malloc = Module._malloc = (e) => (_malloc = Module._malloc = wasmExports.malloc)(e), _calloc = Module._calloc = (e, t) => (_calloc = Module._calloc = wasmExports.calloc)(e, t), _realloc = Module._realloc = (e, t) => (_realloc = Module._realloc = wasmExports.realloc)(e, t), _free = Module._free = (e) => (_free = Module._free = wasmExports.free)(e), _ts_language_symbol_count = Module._ts_language_symbol_count = (e) => (_ts_language_symbol_count = Module._ts_language_symbol_count = wasmExports.ts_language_symbol_count)(e), _ts_language_state_count = Module._ts_language_state_count = (e) => (_ts_language_state_count = Module._ts_language_state_count = wasmExports.ts_language_state_count)(e), _ts_language_version = Module._ts_language_version = (e) => (_ts_language_version = Module._ts_language_version = wasmExports.ts_language_version)(e), _ts_language_field_count = Module._ts_language_field_count = (e) => (_ts_language_field_count = Module._ts_language_field_count = wasmExports.ts_language_field_count)(e), _ts_language_next_state = Module._ts_language_next_state = (e, t, _) => (_ts_language_next_state = Module._ts_language_next_state = wasmExports.ts_language_next_state)(e, t, _), _ts_language_symbol_name = Module._ts_language_symbol_name = (e, t) => (_ts_language_symbol_name = Module._ts_language_symbol_name = wasmExports.ts_language_symbol_name)(e, t), _ts_language_symbol_for_name = Module._ts_language_symbol_for_name = (e, t, _, s) => (_ts_language_symbol_for_name = Module._ts_language_symbol_for_name = wasmExports.ts_language_symbol_for_name)(e, t, _, s), _strncmp = Module._strncmp = (e, t, _) => (_strncmp = Module._strncmp = wasmExports.strncmp)(e, t, _), _ts_language_symbol_type = Module._ts_language_symbol_type = (e, t) => (_ts_language_symbol_type = Module._ts_language_symbol_type = wasmExports.ts_language_symbol_type)(e, t), _ts_language_field_name_for_id = Module._ts_language_field_name_for_id = (e, t) => (_ts_language_field_name_for_id = Module._ts_language_field_name_for_id = wasmExports.ts_language_field_name_for_id)(e, t), _ts_lookahead_iterator_new = Module._ts_lookahead_iterator_new = (e, t) => (_ts_lookahead_iterator_new = Module._ts_lookahead_iterator_new = wasmExports.ts_lookahead_iterator_new)(e, t), _ts_lookahead_iterator_delete = Module._ts_lookahead_iterator_delete = (e) => (_ts_lookahead_iterator_delete = Module._ts_lookahead_iterator_delete = wasmExports.ts_lookahead_iterator_delete)(e), _ts_lookahead_iterator_reset_state = Module._ts_lookahead_iterator_reset_state = (e, t) => (_ts_lookahead_iterator_reset_state = Module._ts_lookahead_iterator_reset_state = wasmExports.ts_lookahead_iterator_reset_state)(e, t), _ts_lookahead_iterator_reset = Module._ts_lookahead_iterator_reset = (e, t, _) => (_ts_lookahead_iterator_reset = Module._ts_lookahead_iterator_reset = wasmExports.ts_lookahead_iterator_reset)(e, t, _), _ts_lookahead_iterator_next = Module._ts_lookahead_iterator_next = (e) => (_ts_lookahead_iterator_next = Module._ts_lookahead_iterator_next = wasmExports.ts_lookahead_iterator_next)(e), _ts_lookahead_iterator_current_symbol = Module._ts_lookahead_iterator_current_symbol = (e) => (_ts_lookahead_iterator_current_symbol = Module._ts_lookahead_iterator_current_symbol = wasmExports.ts_lookahead_iterator_current_symbol)(e), _memset = Module._memset = (e, t, _) => (_memset = Module._memset = wasmExports.memset)(e, t, _), _memcpy = Module._memcpy = (e, t, _) => (_memcpy = Module._memcpy = wasmExports.memcpy)(e, t, _), _ts_parser_delete = Module._ts_parser_delete = (e) => (_ts_parser_delete = Module._ts_parser_delete = wasmExports.ts_parser_delete)(e), _ts_parser_reset = Module._ts_parser_reset = (e) => (_ts_parser_reset = Module._ts_parser_reset = wasmExports.ts_parser_reset)(e), _ts_parser_set_language = Module._ts_parser_set_language = (e, t) => (_ts_parser_set_language = Module._ts_parser_set_language = wasmExports.ts_parser_set_language)(e, t), _ts_parser_timeout_micros = Module._ts_parser_timeout_micros = (e) => (_ts_parser_timeout_micros = Module._ts_parser_timeout_micros = wasmExports.ts_parser_timeout_micros)(e), _ts_parser_set_timeout_micros = Module._ts_parser_set_timeout_micros = (e, t, _) => (_ts_parser_set_timeout_micros = Module._ts_parser_set_timeout_micros = wasmExports.ts_parser_set_timeout_micros)(e, t, _), _ts_parser_set_included_ranges = Module._ts_parser_set_included_ranges = (e, t, _) => (_ts_parser_set_included_ranges = Module._ts_parser_set_included_ranges = wasmExports.ts_parser_set_included_ranges)(e, t, _), _memmove = Module._memmove = (e, t, _) => (_memmove = Module._memmove = wasmExports.memmove)(e, t, _), _memcmp = Module._memcmp = (e, t, _) => (_memcmp = Module._memcmp = wasmExports.memcmp)(e, t, _), _ts_query_new = Module._ts_query_new = (e, t, _, s, r) => (_ts_query_new = Module._ts_query_new = wasmExports.ts_query_new)(e, t, _, s, r), _ts_query_delete = Module._ts_query_delete = (e) => (_ts_query_delete = Module._ts_query_delete = wasmExports.ts_query_delete)(e), _iswspace = Module._iswspace = (e) => (_iswspace = Module._iswspace = wasmExports.iswspace)(e), _iswalnum = Module._iswalnum = (e) => (_iswalnum = Module._iswalnum = wasmExports.iswalnum)(e), _ts_query_pattern_count = Module._ts_query_pattern_count = (e) => (_ts_query_pattern_count = Module._ts_query_pattern_count = wasmExports.ts_query_pattern_count)(e), _ts_query_capture_count = Module._ts_query_capture_count = (e) => (_ts_query_capture_count = Module._ts_query_capture_count = wasmExports.ts_query_capture_count)(e), _ts_query_string_count = Module._ts_query_string_count = (e) => (_ts_query_string_count = Module._ts_query_string_count = wasmExports.ts_query_string_count)(e), _ts_query_capture_name_for_id = Module._ts_query_capture_name_for_id = (e, t, _) => (_ts_query_capture_name_for_id = Module._ts_query_capture_name_for_id = wasmExports.ts_query_capture_name_for_id)(e, t, _), _ts_query_string_value_for_id = Module._ts_query_string_value_for_id = (e, t, _) => (_ts_query_string_value_for_id = Module._ts_query_string_value_for_id = wasmExports.ts_query_string_value_for_id)(e, t, _), _ts_query_predicates_for_pattern = Module._ts_query_predicates_for_pattern = (e, t, _) => (_ts_query_predicates_for_pattern = Module._ts_query_predicates_for_pattern = wasmExports.ts_query_predicates_for_pattern)(e, t, _), _ts_query_disable_capture = Module._ts_query_disable_capture = (e, t, _) => (_ts_query_disable_capture = Module._ts_query_disable_capture = wasmExports.ts_query_disable_capture)(e, t, _), _ts_tree_copy = Module._ts_tree_copy = (e) => (_ts_tree_copy = Module._ts_tree_copy = wasmExports.ts_tree_copy)(e), _ts_tree_delete = Module._ts_tree_delete = (e) => (_ts_tree_delete = Module._ts_tree_delete = wasmExports.ts_tree_delete)(e), _ts_init = Module._ts_init = () => (_ts_init = Module._ts_init = wasmExports.ts_init)(), _ts_parser_new_wasm = Module._ts_parser_new_wasm = () => (_ts_parser_new_wasm = Module._ts_parser_new_wasm = wasmExports.ts_parser_new_wasm)(), _ts_parser_enable_logger_wasm = Module._ts_parser_enable_logger_wasm = (e, t) => (_ts_parser_enable_logger_wasm = Module._ts_parser_enable_logger_wasm = wasmExports.ts_parser_enable_logger_wasm)(e, t), _ts_parser_parse_wasm = Module._ts_parser_parse_wasm = (e, t, _, s, r) => (_ts_parser_parse_wasm = Module._ts_parser_parse_wasm = wasmExports.ts_parser_parse_wasm)(e, t, _, s, r), _ts_parser_included_ranges_wasm = Module._ts_parser_included_ranges_wasm = (e) => (_ts_parser_included_ranges_wasm = Module._ts_parser_included_ranges_wasm = wasmExports.ts_parser_included_ranges_wasm)(e), _ts_language_type_is_named_wasm = Module._ts_language_type_is_named_wasm = (e, t) => (_ts_language_type_is_named_wasm = Module._ts_language_type_is_named_wasm = wasmExports.ts_language_type_is_named_wasm)(e, t), _ts_language_type_is_visible_wasm = Module._ts_language_type_is_visible_wasm = (e, t) => (_ts_language_type_is_visible_wasm = Module._ts_language_type_is_visible_wasm = wasmExports.ts_language_type_is_visible_wasm)(e, t), _ts_tree_root_node_wasm = Module._ts_tree_root_node_wasm = (e) => (_ts_tree_root_node_wasm = Module._ts_tree_root_node_wasm = wasmExports.ts_tree_root_node_wasm)(e), _ts_tree_root_node_with_offset_wasm = Module._ts_tree_root_node_with_offset_wasm = (e) => (_ts_tree_root_node_with_offset_wasm = Module._ts_tree_root_node_with_offset_wasm = wasmExports.ts_tree_root_node_with_offset_wasm)(e), _ts_tree_edit_wasm = Module._ts_tree_edit_wasm = (e) => (_ts_tree_edit_wasm = Module._ts_tree_edit_wasm = wasmExports.ts_tree_edit_wasm)(e), _ts_tree_included_ranges_wasm = Module._ts_tree_included_ranges_wasm = (e) => (_ts_tree_included_ranges_wasm = Module._ts_tree_included_ranges_wasm = wasmExports.ts_tree_included_ranges_wasm)(e), _ts_tree_get_changed_ranges_wasm = Module._ts_tree_get_changed_ranges_wasm = (e, t) => (_ts_tree_get_changed_ranges_wasm = Module._ts_tree_get_changed_ranges_wasm = wasmExports.ts_tree_get_changed_ranges_wasm)(e, t), _ts_tree_cursor_new_wasm = Module._ts_tree_cursor_new_wasm = (e) => (_ts_tree_cursor_new_wasm = Module._ts_tree_cursor_new_wasm = wasmExports.ts_tree_cursor_new_wasm)(e), _ts_tree_cursor_delete_wasm = Module._ts_tree_cursor_delete_wasm = (e) => (_ts_tree_cursor_delete_wasm = Module._ts_tree_cursor_delete_wasm = wasmExports.ts_tree_cursor_delete_wasm)(e), _ts_tree_cursor_reset_wasm = Module._ts_tree_cursor_reset_wasm = (e) => (_ts_tree_cursor_reset_wasm = Module._ts_tree_cursor_reset_wasm = wasmExports.ts_tree_cursor_reset_wasm)(e), _ts_tree_cursor_reset_to_wasm = Module._ts_tree_cursor_reset_to_wasm = (e, t) => (_ts_tree_cursor_reset_to_wasm = Module._ts_tree_cursor_reset_to_wasm = wasmExports.ts_tree_cursor_reset_to_wasm)(e, t), _ts_tree_cursor_goto_first_child_wasm = Module._ts_tree_cursor_goto_first_child_wasm = (e) => (_ts_tree_cursor_goto_first_child_wasm = Module._ts_tree_cursor_goto_first_child_wasm = wasmExports.ts_tree_cursor_goto_first_child_wasm)(e), _ts_tree_cursor_goto_last_child_wasm = Module._ts_tree_cursor_goto_last_child_wasm = (e) => (_ts_tree_cursor_goto_last_child_wasm = Module._ts_tree_cursor_goto_last_child_wasm = wasmExports.ts_tree_cursor_goto_last_child_wasm)(e), _ts_tree_cursor_goto_first_child_for_index_wasm = Module._ts_tree_cursor_goto_first_child_for_index_wasm = (e) => (_ts_tree_cursor_goto_first_child_for_index_wasm = Module._ts_tree_cursor_goto_first_child_for_index_wasm = wasmExports.ts_tree_cursor_goto_first_child_for_index_wasm)(e), _ts_tree_cursor_goto_first_child_for_position_wasm = Module._ts_tree_cursor_goto_first_child_for_position_wasm = (e) => (_ts_tree_cursor_goto_first_child_for_position_wasm = Module._ts_tree_cursor_goto_first_child_for_position_wasm = wasmExports.ts_tree_cursor_goto_first_child_for_position_wasm)(e), _ts_tree_cursor_goto_next_sibling_wasm = Module._ts_tree_cursor_goto_next_sibling_wasm = (e) => (_ts_tree_cursor_goto_next_sibling_wasm = Module._ts_tree_cursor_goto_next_sibling_wasm = wasmExports.ts_tree_cursor_goto_next_sibling_wasm)(e), _ts_tree_cursor_goto_previous_sibling_wasm = Module._ts_tree_cursor_goto_previous_sibling_wasm = (e) => (_ts_tree_cursor_goto_previous_sibling_wasm = Module._ts_tree_cursor_goto_previous_sibling_wasm = wasmExports.ts_tree_cursor_goto_previous_sibling_wasm)(e), _ts_tree_cursor_goto_descendant_wasm = Module._ts_tree_cursor_goto_descendant_wasm = (e, t) => (_ts_tree_cursor_goto_descendant_wasm = Module._ts_tree_cursor_goto_descendant_wasm = wasmExports.ts_tree_cursor_goto_descendant_wasm)(e, t), _ts_tree_cursor_goto_parent_wasm = Module._ts_tree_cursor_goto_parent_wasm = (e) => (_ts_tree_cursor_goto_parent_wasm = Module._ts_tree_cursor_goto_parent_wasm = wasmExports.ts_tree_cursor_goto_parent_wasm)(e), _ts_tree_cursor_current_node_type_id_wasm = Module._ts_tree_cursor_current_node_type_id_wasm = (e) => (_ts_tree_cursor_current_node_type_id_wasm = Module._ts_tree_cursor_current_node_type_id_wasm = wasmExports.ts_tree_cursor_current_node_type_id_wasm)(e), _ts_tree_cursor_current_node_state_id_wasm = Module._ts_tree_cursor_current_node_state_id_wasm = (e) => (_ts_tree_cursor_current_node_state_id_wasm = Module._ts_tree_cursor_current_node_state_id_wasm = wasmExports.ts_tree_cursor_current_node_state_id_wasm)(e), _ts_tree_cursor_current_node_is_named_wasm = Module._ts_tree_cursor_current_node_is_named_wasm = (e) => (_ts_tree_cursor_current_node_is_named_wasm = Module._ts_tree_cursor_current_node_is_named_wasm = wasmExports.ts_tree_cursor_current_node_is_named_wasm)(e), _ts_tree_cursor_current_node_is_missing_wasm = Module._ts_tree_cursor_current_node_is_missing_wasm = (e) => (_ts_tree_cursor_current_node_is_missing_wasm = Module._ts_tree_cursor_current_node_is_missing_wasm = wasmExports.ts_tree_cursor_current_node_is_missing_wasm)(e), _ts_tree_cursor_current_node_id_wasm = Module._ts_tree_cursor_current_node_id_wasm = (e) => (_ts_tree_cursor_current_node_id_wasm = Module._ts_tree_cursor_current_node_id_wasm = wasmExports.ts_tree_cursor_current_node_id_wasm)(e), _ts_tree_cursor_start_position_wasm = Module._ts_tree_cursor_start_position_wasm = (e) => (_ts_tree_cursor_start_position_wasm = Module._ts_tree_cursor_start_position_wasm = wasmExports.ts_tree_cursor_start_position_wasm)(e), _ts_tree_cursor_end_position_wasm = Module._ts_tree_cursor_end_position_wasm = (e) => (_ts_tree_cursor_end_position_wasm = Module._ts_tree_cursor_end_position_wasm = wasmExports.ts_tree_cursor_end_position_wasm)(e), _ts_tree_cursor_start_index_wasm = Module._ts_tree_cursor_start_index_wasm = (e) => (_ts_tree_cursor_start_index_wasm = Module._ts_tree_cursor_start_index_wasm = wasmExports.ts_tree_cursor_start_index_wasm)(e), _ts_tree_cursor_end_index_wasm = Module._ts_tree_cursor_end_index_wasm = (e) => (_ts_tree_cursor_end_index_wasm = Module._ts_tree_cursor_end_index_wasm = wasmExports.ts_tree_cursor_end_index_wasm)(e), _ts_tree_cursor_current_field_id_wasm = Module._ts_tree_cursor_current_field_id_wasm = (e) => (_ts_tree_cursor_current_field_id_wasm = Module._ts_tree_cursor_current_field_id_wasm = wasmExports.ts_tree_cursor_current_field_id_wasm)(e), _ts_tree_cursor_current_depth_wasm = Module._ts_tree_cursor_current_depth_wasm = (e) => (_ts_tree_cursor_current_depth_wasm = Module._ts_tree_cursor_current_depth_wasm = wasmExports.ts_tree_cursor_current_depth_wasm)(e), _ts_tree_cursor_current_descendant_index_wasm = Module._ts_tree_cursor_current_descendant_index_wasm = (e) => (_ts_tree_cursor_current_descendant_index_wasm = Module._ts_tree_cursor_current_descendant_index_wasm = wasmExports.ts_tree_cursor_current_descendant_index_wasm)(e), _ts_tree_cursor_current_node_wasm = Module._ts_tree_cursor_current_node_wasm = (e) => (_ts_tree_cursor_current_node_wasm = Module._ts_tree_cursor_current_node_wasm = wasmExports.ts_tree_cursor_current_node_wasm)(e), _ts_node_symbol_wasm = Module._ts_node_symbol_wasm = (e) => (_ts_node_symbol_wasm = Module._ts_node_symbol_wasm = wasmExports.ts_node_symbol_wasm)(e), _ts_node_field_name_for_child_wasm = Module._ts_node_field_name_for_child_wasm = (e, t) => (_ts_node_field_name_for_child_wasm = Module._ts_node_field_name_for_child_wasm = wasmExports.ts_node_field_name_for_child_wasm)(e, t), _ts_node_children_by_field_id_wasm = Module._ts_node_children_by_field_id_wasm = (e, t) => (_ts_node_children_by_field_id_wasm = Module._ts_node_children_by_field_id_wasm = wasmExports.ts_node_children_by_field_id_wasm)(e, t), _ts_node_first_child_for_byte_wasm = Module._ts_node_first_child_for_byte_wasm = (e) => (_ts_node_first_child_for_byte_wasm = Module._ts_node_first_child_for_byte_wasm = wasmExports.ts_node_first_child_for_byte_wasm)(e), _ts_node_first_named_child_for_byte_wasm = Module._ts_node_first_named_child_for_byte_wasm = (e) => (_ts_node_first_named_child_for_byte_wasm = Module._ts_node_first_named_child_for_byte_wasm = wasmExports.ts_node_first_named_child_for_byte_wasm)(e), _ts_node_grammar_symbol_wasm = Module._ts_node_grammar_symbol_wasm = (e) => (_ts_node_grammar_symbol_wasm = Module._ts_node_grammar_symbol_wasm = wasmExports.ts_node_grammar_symbol_wasm)(e), _ts_node_child_count_wasm = Module._ts_node_child_count_wasm = (e) => (_ts_node_child_count_wasm = Module._ts_node_child_count_wasm = wasmExports.ts_node_child_count_wasm)(e), _ts_node_named_child_count_wasm = Module._ts_node_named_child_count_wasm = (e) => (_ts_node_named_child_count_wasm = Module._ts_node_named_child_count_wasm = wasmExports.ts_node_named_child_count_wasm)(e), _ts_node_child_wasm = Module._ts_node_child_wasm = (e, t) => (_ts_node_child_wasm = Module._ts_node_child_wasm = wasmExports.ts_node_child_wasm)(e, t), _ts_node_named_child_wasm = Module._ts_node_named_child_wasm = (e, t) => (_ts_node_named_child_wasm = Module._ts_node_named_child_wasm = wasmExports.ts_node_named_child_wasm)(e, t), _ts_node_child_by_field_id_wasm = Module._ts_node_child_by_field_id_wasm = (e, t) => (_ts_node_child_by_field_id_wasm = Module._ts_node_child_by_field_id_wasm = wasmExports.ts_node_child_by_field_id_wasm)(e, t), _ts_node_next_sibling_wasm = Module._ts_node_next_sibling_wasm = (e) => (_ts_node_next_sibling_wasm = Module._ts_node_next_sibling_wasm = wasmExports.ts_node_next_sibling_wasm)(e), _ts_node_prev_sibling_wasm = Module._ts_node_prev_sibling_wasm = (e) => (_ts_node_prev_sibling_wasm = Module._ts_node_prev_sibling_wasm = wasmExports.ts_node_prev_sibling_wasm)(e), _ts_node_next_named_sibling_wasm = Module._ts_node_next_named_sibling_wasm = (e) => (_ts_node_next_named_sibling_wasm = Module._ts_node_next_named_sibling_wasm = wasmExports.ts_node_next_named_sibling_wasm)(e), _ts_node_prev_named_sibling_wasm = Module._ts_node_prev_named_sibling_wasm = (e) => (_ts_node_prev_named_sibling_wasm = Module._ts_node_prev_named_sibling_wasm = wasmExports.ts_node_prev_named_sibling_wasm)(e), _ts_node_descendant_count_wasm = Module._ts_node_descendant_count_wasm = (e) => (_ts_node_descendant_count_wasm = Module._ts_node_descendant_count_wasm = wasmExports.ts_node_descendant_count_wasm)(e), _ts_node_parent_wasm = Module._ts_node_parent_wasm = (e) => (_ts_node_parent_wasm = Module._ts_node_parent_wasm = wasmExports.ts_node_parent_wasm)(e), _ts_node_descendant_for_index_wasm = Module._ts_node_descendant_for_index_wasm = (e) => (_ts_node_descendant_for_index_wasm = Module._ts_node_descendant_for_index_wasm = wasmExports.ts_node_descendant_for_index_wasm)(e), _ts_node_named_descendant_for_index_wasm = Module._ts_node_named_descendant_for_index_wasm = (e) => (_ts_node_named_descendant_for_index_wasm = Module._ts_node_named_descendant_for_index_wasm = wasmExports.ts_node_named_descendant_for_index_wasm)(e), _ts_node_descendant_for_position_wasm = Module._ts_node_descendant_for_position_wasm = (e) => (_ts_node_descendant_for_position_wasm = Module._ts_node_descendant_for_position_wasm = wasmExports.ts_node_descendant_for_position_wasm)(e), _ts_node_named_descendant_for_position_wasm = Module._ts_node_named_descendant_for_position_wasm = (e) => (_ts_node_named_descendant_for_position_wasm = Module._ts_node_named_descendant_for_position_wasm = wasmExports.ts_node_named_descendant_for_position_wasm)(e), _ts_node_start_point_wasm = Module._ts_node_start_point_wasm = (e) => (_ts_node_start_point_wasm = Module._ts_node_start_point_wasm = wasmExports.ts_node_start_point_wasm)(e), _ts_node_end_point_wasm = Module._ts_node_end_point_wasm = (e) => (_ts_node_end_point_wasm = Module._ts_node_end_point_wasm = wasmExports.ts_node_end_point_wasm)(e), _ts_node_start_index_wasm = Module._ts_node_start_index_wasm = (e) => (_ts_node_start_index_wasm = Module._ts_node_start_index_wasm = wasmExports.ts_node_start_index_wasm)(e), _ts_node_end_index_wasm = Module._ts_node_end_index_wasm = (e) => (_ts_node_end_index_wasm = Module._ts_node_end_index_wasm = wasmExports.ts_node_end_index_wasm)(e), _ts_node_to_string_wasm = Module._ts_node_to_string_wasm = (e) => (_ts_node_to_string_wasm = Module._ts_node_to_string_wasm = wasmExports.ts_node_to_string_wasm)(e), _ts_node_children_wasm = Module._ts_node_children_wasm = (e) => (_ts_node_children_wasm = Module._ts_node_children_wasm = wasmExports.ts_node_children_wasm)(e), _ts_node_named_children_wasm = Module._ts_node_named_children_wasm = (e) => (_ts_node_named_children_wasm = Module._ts_node_named_children_wasm = wasmExports.ts_node_named_children_wasm)(e), _ts_node_descendants_of_type_wasm = Module._ts_node_descendants_of_type_wasm = (e, t, _, s, r, a, o) => (_ts_node_descendants_of_type_wasm = Module._ts_node_descendants_of_type_wasm = wasmExports.ts_node_descendants_of_type_wasm)(e, t, _, s, r, a, o), _ts_node_is_named_wasm = Module._ts_node_is_named_wasm = (e) => (_ts_node_is_named_wasm = Module._ts_node_is_named_wasm = wasmExports.ts_node_is_named_wasm)(e), _ts_node_has_changes_wasm = Module._ts_node_has_changes_wasm = (e) => (_ts_node_has_changes_wasm = Module._ts_node_has_changes_wasm = wasmExports.ts_node_has_changes_wasm)(e), _ts_node_has_error_wasm = Module._ts_node_has_error_wasm = (e) => (_ts_node_has_error_wasm = Module._ts_node_has_error_wasm = wasmExports.ts_node_has_error_wasm)(e), _ts_node_is_error_wasm = Module._ts_node_is_error_wasm = (e) => (_ts_node_is_error_wasm = Module._ts_node_is_error_wasm = wasmExports.ts_node_is_error_wasm)(e), _ts_node_is_missing_wasm = Module._ts_node_is_missing_wasm = (e) => (_ts_node_is_missing_wasm = Module._ts_node_is_missing_wasm = wasmExports.ts_node_is_missing_wasm)(e), _ts_node_is_extra_wasm = Module._ts_node_is_extra_wasm = (e) => (_ts_node_is_extra_wasm = Module._ts_node_is_extra_wasm = wasmExports.ts_node_is_extra_wasm)(e), _ts_node_parse_state_wasm = Module._ts_node_parse_state_wasm = (e) => (_ts_node_parse_state_wasm = Module._ts_node_parse_state_wasm = wasmExports.ts_node_parse_state_wasm)(e), _ts_node_next_parse_state_wasm = Module._ts_node_next_parse_state_wasm = (e) => (_ts_node_next_parse_state_wasm = Module._ts_node_next_parse_state_wasm = wasmExports.ts_node_next_parse_state_wasm)(e), _ts_query_matches_wasm = Module._ts_query_matches_wasm = (e, t, _, s, r, a, o, n, l, d) => (_ts_query_matches_wasm = Module._ts_query_matches_wasm = wasmExports.ts_query_matches_wasm)(e, t, _, s, r, a, o, n, l, d), _ts_query_captures_wasm = Module._ts_query_captures_wasm = (e, t, _, s, r, a, o, n, l, d) => (_ts_query_captures_wasm = Module._ts_query_captures_wasm = wasmExports.ts_query_captures_wasm)(e, t, _, s, r, a, o, n, l, d), _iswalpha = Module._iswalpha = (e) => (_iswalpha = Module._iswalpha = wasmExports.iswalpha)(e), _iswblank = Module._iswblank = (e) => (_iswblank = Module._iswblank = wasmExports.iswblank)(e), _iswdigit = Module._iswdigit = (e) => (_iswdigit = Module._iswdigit = wasmExports.iswdigit)(e), _iswlower = Module._iswlower = (e) => (_iswlower = Module._iswlower = wasmExports.iswlower)(e), _iswupper = Module._iswupper = (e) => (_iswupper = Module._iswupper = wasmExports.iswupper)(e), _iswxdigit = Module._iswxdigit = (e) => (_iswxdigit = Module._iswxdigit = wasmExports.iswxdigit)(e), _memchr = Module._memchr = (e, t, _) => (_memchr = Module._memchr = wasmExports.memchr)(e, t, _), _strlen = Module._strlen = (e) => (_strlen = Module._strlen = wasmExports.strlen)(e), _strcmp = Module._strcmp = (e, t) => (_strcmp = Module._strcmp = wasmExports.strcmp)(e, t), _strncat = Module._strncat = (e, t, _) => (_strncat = Module._strncat = wasmExports.strncat)(e, t, _), _strncpy = Module._strncpy = (e, t, _) => (_strncpy = Module._strncpy = wasmExports.strncpy)(e, t, _), _towlower = Module._towlower = (e) => (_towlower = Module._towlower = wasmExports.towlower)(e), _towupper = Module._towupper = (e) => (_towupper = Module._towupper = wasmExports.towupper)(e), _setThrew = (e, t) => (_setThrew = wasmExports.setThrew)(e, t), stackSave = () => (stackSave = wasmExports.stackSave)(), stackRestore = (e) => (stackRestore = wasmExports.stackRestore)(e), stackAlloc = (e) => (stackAlloc = wasmExports.stackAlloc)(e), dynCall_jiji = Module.dynCall_jiji = (e, t, _, s, r) => (dynCall_jiji = Module.dynCall_jiji = wasmExports.dynCall_jiji)(e, t, _, s, r), _orig$ts_parser_timeout_micros = Module._orig$ts_parser_timeout_micros = (e) => (_orig$ts_parser_timeout_micros = Module._orig$ts_parser_timeout_micros = wasmExports.orig$ts_parser_timeout_micros)(e), _orig$ts_parser_set_timeout_micros = Module._orig$ts_parser_set_timeout_micros = (e, t) => (_orig$ts_parser_set_timeout_micros = Module._orig$ts_parser_set_timeout_micros = wasmExports.orig$ts_parser_set_timeout_micros)(e, t), calledRun;
            function callMain(e = []) {
              var t = resolveGlobalSymbol("main").sym;
              if (t) {
                e.unshift(thisProgram);
                var _ = e.length, s = stackAlloc(4 * (_ + 1)), r = s;
                e.forEach(((e2) => {
                  HEAPU32[r >> 2] = stringToUTF8OnStack(e2), r += 4;
                })), HEAPU32[r >> 2] = 0;
                try {
                  var a = t(_, s);
                  return exitJS(a, true), a;
                } catch (e2) {
                  return handleException(e2);
                }
              }
            }
            function run(e = arguments_) {
              function t() {
                calledRun || (calledRun = true, Module.calledRun = true, ABORT || (initRuntime(), preMain(), Module.onRuntimeInitialized && Module.onRuntimeInitialized(), shouldRunNow && callMain(e), postRun()));
              }
              runDependencies > 0 || (preRun(), runDependencies > 0 || (Module.setStatus ? (Module.setStatus("Running..."), setTimeout((function() {
                setTimeout((function() {
                  Module.setStatus("");
                }), 1), t();
              }), 1)) : t()));
            }
            if (Module.AsciiToString = AsciiToString, Module.stringToUTF16 = stringToUTF16, dependenciesFulfilled = function e() {
              calledRun || run(), calledRun || (dependenciesFulfilled = e);
            }, Module.preInit) for ("function" == typeof Module.preInit && (Module.preInit = [Module.preInit]); Module.preInit.length > 0; ) Module.preInit.pop()();
            var shouldRunNow = true;
            Module.noInitialRun && (shouldRunNow = false), run();
            const C = Module, INTERNAL = {}, SIZE_OF_INT = 4, SIZE_OF_CURSOR = 4 * SIZE_OF_INT, SIZE_OF_NODE = 5 * SIZE_OF_INT, SIZE_OF_POINT = 2 * SIZE_OF_INT, SIZE_OF_RANGE = 2 * SIZE_OF_INT + 2 * SIZE_OF_POINT, ZERO_POINT = { row: 0, column: 0 }, QUERY_WORD_REGEX = /[\w-.]*/g, PREDICATE_STEP_TYPE_CAPTURE = 1, PREDICATE_STEP_TYPE_STRING = 2, LANGUAGE_FUNCTION_REGEX = /^_?tree_sitter_\w+/;
            let VERSION, MIN_COMPATIBLE_VERSION, TRANSFER_BUFFER, currentParseCallback, currentLogCallback;
            class ParserImpl {
              static init() {
                TRANSFER_BUFFER = C._ts_init(), VERSION = getValue(TRANSFER_BUFFER, "i32"), MIN_COMPATIBLE_VERSION = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
              }
              initialize() {
                C._ts_parser_new_wasm(), this[0] = getValue(TRANSFER_BUFFER, "i32"), this[1] = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
              }
              delete() {
                C._ts_parser_delete(this[0]), C._free(this[1]), this[0] = 0, this[1] = 0;
              }
              setLanguage(e) {
                let t;
                if (e) {
                  if (e.constructor !== Language) throw new Error("Argument must be a Language");
                  {
                    t = e[0];
                    const _ = C._ts_language_version(t);
                    if (_ < MIN_COMPATIBLE_VERSION || VERSION < _) throw new Error(`Incompatible language version ${_}. Compatibility range ${MIN_COMPATIBLE_VERSION} through ${VERSION}.`);
                  }
                } else t = 0, e = null;
                return this.language = e, C._ts_parser_set_language(this[0], t), this;
              }
              getLanguage() {
                return this.language;
              }
              parse(e, t, _) {
                if ("string" == typeof e) currentParseCallback = (t2, _2) => e.slice(t2);
                else {
                  if ("function" != typeof e) throw new Error("Argument must be a string or a function");
                  currentParseCallback = e;
                }
                this.logCallback ? (currentLogCallback = this.logCallback, C._ts_parser_enable_logger_wasm(this[0], 1)) : (currentLogCallback = null, C._ts_parser_enable_logger_wasm(this[0], 0));
                let s = 0, r = 0;
                if (_?.includedRanges) {
                  s = _.includedRanges.length, r = C._calloc(s, SIZE_OF_RANGE);
                  let e2 = r;
                  for (let t2 = 0; t2 < s; t2++) marshalRange(e2, _.includedRanges[t2]), e2 += SIZE_OF_RANGE;
                }
                const a = C._ts_parser_parse_wasm(this[0], this[1], t ? t[0] : 0, r, s);
                if (!a) throw currentParseCallback = null, currentLogCallback = null, new Error("Parsing failed");
                const o = new Tree(INTERNAL, a, this.language, currentParseCallback);
                return currentParseCallback = null, currentLogCallback = null, o;
              }
              reset() {
                C._ts_parser_reset(this[0]);
              }
              getIncludedRanges() {
                C._ts_parser_included_ranges_wasm(this[0]);
                const e = getValue(TRANSFER_BUFFER, "i32"), t = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), _ = new Array(e);
                if (e > 0) {
                  let s = t;
                  for (let t2 = 0; t2 < e; t2++) _[t2] = unmarshalRange(s), s += SIZE_OF_RANGE;
                  C._free(t);
                }
                return _;
              }
              getTimeoutMicros() {
                return C._ts_parser_timeout_micros(this[0]);
              }
              setTimeoutMicros(e) {
                C._ts_parser_set_timeout_micros(this[0], e);
              }
              setLogger(e) {
                if (e) {
                  if ("function" != typeof e) throw new Error("Logger callback must be a function");
                } else e = null;
                return this.logCallback = e, this;
              }
              getLogger() {
                return this.logCallback;
              }
            }
            class Tree {
              constructor(e, t, _, s) {
                assertInternal(e), this[0] = t, this.language = _, this.textCallback = s;
              }
              copy() {
                const e = C._ts_tree_copy(this[0]);
                return new Tree(INTERNAL, e, this.language, this.textCallback);
              }
              delete() {
                C._ts_tree_delete(this[0]), this[0] = 0;
              }
              edit(e) {
                marshalEdit(e), C._ts_tree_edit_wasm(this[0]);
              }
              get rootNode() {
                return C._ts_tree_root_node_wasm(this[0]), unmarshalNode(this);
              }
              rootNodeWithOffset(e, t) {
                const _ = TRANSFER_BUFFER + SIZE_OF_NODE;
                return setValue(_, e, "i32"), marshalPoint(_ + SIZE_OF_INT, t), C._ts_tree_root_node_with_offset_wasm(this[0]), unmarshalNode(this);
              }
              getLanguage() {
                return this.language;
              }
              walk() {
                return this.rootNode.walk();
              }
              getChangedRanges(e) {
                if (e.constructor !== Tree) throw new TypeError("Argument must be a Tree");
                C._ts_tree_get_changed_ranges_wasm(this[0], e[0]);
                const t = getValue(TRANSFER_BUFFER, "i32"), _ = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), s = new Array(t);
                if (t > 0) {
                  let e2 = _;
                  for (let _2 = 0; _2 < t; _2++) s[_2] = unmarshalRange(e2), e2 += SIZE_OF_RANGE;
                  C._free(_);
                }
                return s;
              }
              getIncludedRanges() {
                C._ts_tree_included_ranges_wasm(this[0]);
                const e = getValue(TRANSFER_BUFFER, "i32"), t = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), _ = new Array(e);
                if (e > 0) {
                  let s = t;
                  for (let t2 = 0; t2 < e; t2++) _[t2] = unmarshalRange(s), s += SIZE_OF_RANGE;
                  C._free(t);
                }
                return _;
              }
            }
            class Node {
              constructor(e, t) {
                assertInternal(e), this.tree = t;
              }
              get typeId() {
                return marshalNode(this), C._ts_node_symbol_wasm(this.tree[0]);
              }
              get grammarId() {
                return marshalNode(this), C._ts_node_grammar_symbol_wasm(this.tree[0]);
              }
              get type() {
                return this.tree.language.types[this.typeId] || "ERROR";
              }
              get grammarType() {
                return this.tree.language.types[this.grammarId] || "ERROR";
              }
              get endPosition() {
                return marshalNode(this), C._ts_node_end_point_wasm(this.tree[0]), unmarshalPoint(TRANSFER_BUFFER);
              }
              get endIndex() {
                return marshalNode(this), C._ts_node_end_index_wasm(this.tree[0]);
              }
              get text() {
                return getText(this.tree, this.startIndex, this.endIndex);
              }
              get parseState() {
                return marshalNode(this), C._ts_node_parse_state_wasm(this.tree[0]);
              }
              get nextParseState() {
                return marshalNode(this), C._ts_node_next_parse_state_wasm(this.tree[0]);
              }
              get isNamed() {
                return marshalNode(this), 1 === C._ts_node_is_named_wasm(this.tree[0]);
              }
              get hasError() {
                return marshalNode(this), 1 === C._ts_node_has_error_wasm(this.tree[0]);
              }
              get hasChanges() {
                return marshalNode(this), 1 === C._ts_node_has_changes_wasm(this.tree[0]);
              }
              get isError() {
                return marshalNode(this), 1 === C._ts_node_is_error_wasm(this.tree[0]);
              }
              get isMissing() {
                return marshalNode(this), 1 === C._ts_node_is_missing_wasm(this.tree[0]);
              }
              get isExtra() {
                return marshalNode(this), 1 === C._ts_node_is_extra_wasm(this.tree[0]);
              }
              equals(e) {
                return this.id === e.id;
              }
              child(e) {
                return marshalNode(this), C._ts_node_child_wasm(this.tree[0], e), unmarshalNode(this.tree);
              }
              namedChild(e) {
                return marshalNode(this), C._ts_node_named_child_wasm(this.tree[0], e), unmarshalNode(this.tree);
              }
              childForFieldId(e) {
                return marshalNode(this), C._ts_node_child_by_field_id_wasm(this.tree[0], e), unmarshalNode(this.tree);
              }
              childForFieldName(e) {
                const t = this.tree.language.fields.indexOf(e);
                return -1 !== t ? this.childForFieldId(t) : null;
              }
              fieldNameForChild(e) {
                marshalNode(this);
                const t = C._ts_node_field_name_for_child_wasm(this.tree[0], e);
                if (!t) return null;
                return AsciiToString(t);
              }
              childrenForFieldName(e) {
                const t = this.tree.language.fields.indexOf(e);
                return -1 !== t && 0 !== t ? this.childrenForFieldId(t) : [];
              }
              childrenForFieldId(e) {
                marshalNode(this), C._ts_node_children_by_field_id_wasm(this.tree[0], e);
                const t = getValue(TRANSFER_BUFFER, "i32"), _ = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), s = new Array(t);
                if (t > 0) {
                  let e2 = _;
                  for (let _2 = 0; _2 < t; _2++) s[_2] = unmarshalNode(this.tree, e2), e2 += SIZE_OF_NODE;
                  C._free(_);
                }
                return s;
              }
              firstChildForIndex(e) {
                marshalNode(this);
                return setValue(TRANSFER_BUFFER + SIZE_OF_NODE, e, "i32"), C._ts_node_first_child_for_byte_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              firstNamedChildForIndex(e) {
                marshalNode(this);
                return setValue(TRANSFER_BUFFER + SIZE_OF_NODE, e, "i32"), C._ts_node_first_named_child_for_byte_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get childCount() {
                return marshalNode(this), C._ts_node_child_count_wasm(this.tree[0]);
              }
              get namedChildCount() {
                return marshalNode(this), C._ts_node_named_child_count_wasm(this.tree[0]);
              }
              get firstChild() {
                return this.child(0);
              }
              get firstNamedChild() {
                return this.namedChild(0);
              }
              get lastChild() {
                return this.child(this.childCount - 1);
              }
              get lastNamedChild() {
                return this.namedChild(this.namedChildCount - 1);
              }
              get children() {
                if (!this._children) {
                  marshalNode(this), C._ts_node_children_wasm(this.tree[0]);
                  const e = getValue(TRANSFER_BUFFER, "i32"), t = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
                  if (this._children = new Array(e), e > 0) {
                    let _ = t;
                    for (let t2 = 0; t2 < e; t2++) this._children[t2] = unmarshalNode(this.tree, _), _ += SIZE_OF_NODE;
                    C._free(t);
                  }
                }
                return this._children;
              }
              get namedChildren() {
                if (!this._namedChildren) {
                  marshalNode(this), C._ts_node_named_children_wasm(this.tree[0]);
                  const e = getValue(TRANSFER_BUFFER, "i32"), t = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
                  if (this._namedChildren = new Array(e), e > 0) {
                    let _ = t;
                    for (let t2 = 0; t2 < e; t2++) this._namedChildren[t2] = unmarshalNode(this.tree, _), _ += SIZE_OF_NODE;
                    C._free(t);
                  }
                }
                return this._namedChildren;
              }
              descendantsOfType(e, t, _) {
                Array.isArray(e) || (e = [e]), t || (t = ZERO_POINT), _ || (_ = ZERO_POINT);
                const s = [], r = this.tree.language.types;
                for (let t2 = 0, _2 = r.length; t2 < _2; t2++) e.includes(r[t2]) && s.push(t2);
                const a = C._malloc(SIZE_OF_INT * s.length);
                for (let e2 = 0, t2 = s.length; e2 < t2; e2++) setValue(a + e2 * SIZE_OF_INT, s[e2], "i32");
                marshalNode(this), C._ts_node_descendants_of_type_wasm(this.tree[0], a, s.length, t.row, t.column, _.row, _.column);
                const o = getValue(TRANSFER_BUFFER, "i32"), n = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), l = new Array(o);
                if (o > 0) {
                  let e2 = n;
                  for (let t2 = 0; t2 < o; t2++) l[t2] = unmarshalNode(this.tree, e2), e2 += SIZE_OF_NODE;
                }
                return C._free(n), C._free(a), l;
              }
              get nextSibling() {
                return marshalNode(this), C._ts_node_next_sibling_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get previousSibling() {
                return marshalNode(this), C._ts_node_prev_sibling_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get nextNamedSibling() {
                return marshalNode(this), C._ts_node_next_named_sibling_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get previousNamedSibling() {
                return marshalNode(this), C._ts_node_prev_named_sibling_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get descendantCount() {
                return marshalNode(this), C._ts_node_descendant_count_wasm(this.tree[0]);
              }
              get parent() {
                return marshalNode(this), C._ts_node_parent_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              descendantForIndex(e, t = e) {
                if ("number" != typeof e || "number" != typeof t) throw new Error("Arguments must be numbers");
                marshalNode(this);
                const _ = TRANSFER_BUFFER + SIZE_OF_NODE;
                return setValue(_, e, "i32"), setValue(_ + SIZE_OF_INT, t, "i32"), C._ts_node_descendant_for_index_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              namedDescendantForIndex(e, t = e) {
                if ("number" != typeof e || "number" != typeof t) throw new Error("Arguments must be numbers");
                marshalNode(this);
                const _ = TRANSFER_BUFFER + SIZE_OF_NODE;
                return setValue(_, e, "i32"), setValue(_ + SIZE_OF_INT, t, "i32"), C._ts_node_named_descendant_for_index_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              descendantForPosition(e, t = e) {
                if (!isPoint(e) || !isPoint(t)) throw new Error("Arguments must be {row, column} objects");
                marshalNode(this);
                const _ = TRANSFER_BUFFER + SIZE_OF_NODE;
                return marshalPoint(_, e), marshalPoint(_ + SIZE_OF_POINT, t), C._ts_node_descendant_for_position_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              namedDescendantForPosition(e, t = e) {
                if (!isPoint(e) || !isPoint(t)) throw new Error("Arguments must be {row, column} objects");
                marshalNode(this);
                const _ = TRANSFER_BUFFER + SIZE_OF_NODE;
                return marshalPoint(_, e), marshalPoint(_ + SIZE_OF_POINT, t), C._ts_node_named_descendant_for_position_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              walk() {
                return marshalNode(this), C._ts_tree_cursor_new_wasm(this.tree[0]), new TreeCursor(INTERNAL, this.tree);
              }
              toString() {
                marshalNode(this);
                const e = C._ts_node_to_string_wasm(this.tree[0]), t = AsciiToString(e);
                return C._free(e), t;
              }
            }
            class TreeCursor {
              constructor(e, t) {
                assertInternal(e), this.tree = t, unmarshalTreeCursor(this);
              }
              delete() {
                marshalTreeCursor(this), C._ts_tree_cursor_delete_wasm(this.tree[0]), this[0] = this[1] = this[2] = 0;
              }
              reset(e) {
                marshalNode(e), marshalTreeCursor(this, TRANSFER_BUFFER + SIZE_OF_NODE), C._ts_tree_cursor_reset_wasm(this.tree[0]), unmarshalTreeCursor(this);
              }
              resetTo(e) {
                marshalTreeCursor(this, TRANSFER_BUFFER), marshalTreeCursor(e, TRANSFER_BUFFER + SIZE_OF_CURSOR), C._ts_tree_cursor_reset_to_wasm(this.tree[0], e.tree[0]), unmarshalTreeCursor(this);
              }
              get nodeType() {
                return this.tree.language.types[this.nodeTypeId] || "ERROR";
              }
              get nodeTypeId() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_node_type_id_wasm(this.tree[0]);
              }
              get nodeStateId() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_node_state_id_wasm(this.tree[0]);
              }
              get nodeId() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_node_id_wasm(this.tree[0]);
              }
              get nodeIsNamed() {
                return marshalTreeCursor(this), 1 === C._ts_tree_cursor_current_node_is_named_wasm(this.tree[0]);
              }
              get nodeIsMissing() {
                return marshalTreeCursor(this), 1 === C._ts_tree_cursor_current_node_is_missing_wasm(this.tree[0]);
              }
              get nodeText() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_start_index_wasm(this.tree[0]), t = C._ts_tree_cursor_end_index_wasm(this.tree[0]);
                return getText(this.tree, e, t);
              }
              get startPosition() {
                return marshalTreeCursor(this), C._ts_tree_cursor_start_position_wasm(this.tree[0]), unmarshalPoint(TRANSFER_BUFFER);
              }
              get endPosition() {
                return marshalTreeCursor(this), C._ts_tree_cursor_end_position_wasm(this.tree[0]), unmarshalPoint(TRANSFER_BUFFER);
              }
              get startIndex() {
                return marshalTreeCursor(this), C._ts_tree_cursor_start_index_wasm(this.tree[0]);
              }
              get endIndex() {
                return marshalTreeCursor(this), C._ts_tree_cursor_end_index_wasm(this.tree[0]);
              }
              get currentNode() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_node_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get currentFieldId() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_field_id_wasm(this.tree[0]);
              }
              get currentFieldName() {
                return this.tree.language.fields[this.currentFieldId];
              }
              get currentDepth() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_depth_wasm(this.tree[0]);
              }
              get currentDescendantIndex() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_descendant_index_wasm(this.tree[0]);
              }
              gotoFirstChild() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_goto_first_child_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === e;
              }
              gotoLastChild() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_goto_last_child_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === e;
              }
              gotoFirstChildForIndex(e) {
                marshalTreeCursor(this), setValue(TRANSFER_BUFFER + SIZE_OF_CURSOR, e, "i32");
                const t = C._ts_tree_cursor_goto_first_child_for_index_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === t;
              }
              gotoFirstChildForPosition(e) {
                marshalTreeCursor(this), marshalPoint(TRANSFER_BUFFER + SIZE_OF_CURSOR, e);
                const t = C._ts_tree_cursor_goto_first_child_for_position_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === t;
              }
              gotoNextSibling() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_goto_next_sibling_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === e;
              }
              gotoPreviousSibling() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_goto_previous_sibling_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === e;
              }
              gotoDescendant(e) {
                marshalTreeCursor(this), C._ts_tree_cursor_goto_descendant_wasm(this.tree[0], e), unmarshalTreeCursor(this);
              }
              gotoParent() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_goto_parent_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === e;
              }
            }
            class Language {
              constructor(e, t) {
                assertInternal(e), this[0] = t, this.types = new Array(C._ts_language_symbol_count(this[0]));
                for (let e2 = 0, t2 = this.types.length; e2 < t2; e2++) C._ts_language_symbol_type(this[0], e2) < 2 && (this.types[e2] = UTF8ToString(C._ts_language_symbol_name(this[0], e2)));
                this.fields = new Array(C._ts_language_field_count(this[0]) + 1);
                for (let e2 = 0, t2 = this.fields.length; e2 < t2; e2++) {
                  const t3 = C._ts_language_field_name_for_id(this[0], e2);
                  this.fields[e2] = 0 !== t3 ? UTF8ToString(t3) : null;
                }
              }
              get version() {
                return C._ts_language_version(this[0]);
              }
              get fieldCount() {
                return this.fields.length - 1;
              }
              get stateCount() {
                return C._ts_language_state_count(this[0]);
              }
              fieldIdForName(e) {
                const t = this.fields.indexOf(e);
                return -1 !== t ? t : null;
              }
              fieldNameForId(e) {
                return this.fields[e] || null;
              }
              idForNodeType(e, t) {
                const _ = lengthBytesUTF8(e), s = C._malloc(_ + 1);
                stringToUTF8(e, s, _ + 1);
                const r = C._ts_language_symbol_for_name(this[0], s, _, t);
                return C._free(s), r || null;
              }
              get nodeTypeCount() {
                return C._ts_language_symbol_count(this[0]);
              }
              nodeTypeForId(e) {
                const t = C._ts_language_symbol_name(this[0], e);
                return t ? UTF8ToString(t) : null;
              }
              nodeTypeIsNamed(e) {
                return !!C._ts_language_type_is_named_wasm(this[0], e);
              }
              nodeTypeIsVisible(e) {
                return !!C._ts_language_type_is_visible_wasm(this[0], e);
              }
              nextState(e, t) {
                return C._ts_language_next_state(this[0], e, t);
              }
              lookaheadIterator(e) {
                const t = C._ts_lookahead_iterator_new(this[0], e);
                return t ? new LookaheadIterable(INTERNAL, t, this) : null;
              }
              query(e) {
                const t = lengthBytesUTF8(e), _ = C._malloc(t + 1);
                stringToUTF8(e, _, t + 1);
                const s = C._ts_query_new(this[0], _, t, TRANSFER_BUFFER, TRANSFER_BUFFER + SIZE_OF_INT);
                if (!s) {
                  const t2 = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), s2 = getValue(TRANSFER_BUFFER, "i32"), r2 = UTF8ToString(_, s2).length, a2 = e.substr(r2, 100).split("\n")[0];
                  let o2, n2 = a2.match(QUERY_WORD_REGEX)[0];
                  switch (t2) {
                    case 2:
                      o2 = new RangeError(`Bad node name '${n2}'`);
                      break;
                    case 3:
                      o2 = new RangeError(`Bad field name '${n2}'`);
                      break;
                    case 4:
                      o2 = new RangeError(`Bad capture name @${n2}`);
                      break;
                    case 5:
                      o2 = new TypeError(`Bad pattern structure at offset ${r2}: '${a2}'...`), n2 = "";
                      break;
                    default:
                      o2 = new SyntaxError(`Bad syntax at offset ${r2}: '${a2}'...`), n2 = "";
                  }
                  throw o2.index = r2, o2.length = n2.length, C._free(_), o2;
                }
                const r = C._ts_query_string_count(s), a = C._ts_query_capture_count(s), o = C._ts_query_pattern_count(s), n = new Array(a), l = new Array(r);
                for (let e2 = 0; e2 < a; e2++) {
                  const t2 = C._ts_query_capture_name_for_id(s, e2, TRANSFER_BUFFER), _2 = getValue(TRANSFER_BUFFER, "i32");
                  n[e2] = UTF8ToString(t2, _2);
                }
                for (let e2 = 0; e2 < r; e2++) {
                  const t2 = C._ts_query_string_value_for_id(s, e2, TRANSFER_BUFFER), _2 = getValue(TRANSFER_BUFFER, "i32");
                  l[e2] = UTF8ToString(t2, _2);
                }
                const d = new Array(o), u = new Array(o), m = new Array(o), c = new Array(o), w = new Array(o);
                for (let e2 = 0; e2 < o; e2++) {
                  const t2 = C._ts_query_predicates_for_pattern(s, e2, TRANSFER_BUFFER), _2 = getValue(TRANSFER_BUFFER, "i32");
                  c[e2] = [], w[e2] = [];
                  const r2 = [];
                  let a2 = t2;
                  for (let t3 = 0; t3 < _2; t3++) {
                    const t4 = getValue(a2, "i32");
                    a2 += SIZE_OF_INT;
                    const _3 = getValue(a2, "i32");
                    if (a2 += SIZE_OF_INT, t4 === PREDICATE_STEP_TYPE_CAPTURE) r2.push({ type: "capture", name: n[_3] });
                    else if (t4 === PREDICATE_STEP_TYPE_STRING) r2.push({ type: "string", value: l[_3] });
                    else if (r2.length > 0) {
                      if ("string" !== r2[0].type) throw new Error("Predicates must begin with a literal value");
                      const t5 = r2[0].value;
                      let _4, s2 = true, a3 = true;
                      switch (t5) {
                        case "any-not-eq?":
                        case "not-eq?":
                          s2 = false;
                        case "any-eq?":
                        case "eq?":
                          if (3 !== r2.length) throw new Error(`Wrong number of arguments to \`#${t5}\` predicate. Expected 2, got ${r2.length - 1}`);
                          if ("capture" !== r2[1].type) throw new Error(`First argument of \`#${t5}\` predicate must be a capture. Got "${r2[1].value}"`);
                          if (a3 = !t5.startsWith("any-"), "capture" === r2[2].type) {
                            const t6 = r2[1].name, _5 = r2[2].name;
                            w[e2].push(((e3) => {
                              const r3 = [], o3 = [];
                              for (const s3 of e3) s3.name === t6 && r3.push(s3.node), s3.name === _5 && o3.push(s3.node);
                              const n3 = (e4, t7, _6) => _6 ? e4.text === t7.text : e4.text !== t7.text;
                              return a3 ? r3.every(((e4) => o3.some(((t7) => n3(e4, t7, s2))))) : r3.some(((e4) => o3.some(((t7) => n3(e4, t7, s2)))));
                            }));
                          } else {
                            _4 = r2[1].name;
                            const t6 = r2[2].value, o3 = (e3) => e3.text === t6, n3 = (e3) => e3.text !== t6;
                            w[e2].push(((e3) => {
                              const t7 = [];
                              for (const s3 of e3) s3.name === _4 && t7.push(s3.node);
                              const r3 = s2 ? o3 : n3;
                              return a3 ? t7.every(r3) : t7.some(r3);
                            }));
                          }
                          break;
                        case "any-not-match?":
                        case "not-match?":
                          s2 = false;
                        case "any-match?":
                        case "match?":
                          if (3 !== r2.length) throw new Error(`Wrong number of arguments to \`#${t5}\` predicate. Expected 2, got ${r2.length - 1}.`);
                          if ("capture" !== r2[1].type) throw new Error(`First argument of \`#${t5}\` predicate must be a capture. Got "${r2[1].value}".`);
                          if ("string" !== r2[2].type) throw new Error(`Second argument of \`#${t5}\` predicate must be a string. Got @${r2[2].value}.`);
                          _4 = r2[1].name;
                          const o2 = new RegExp(r2[2].value);
                          a3 = !t5.startsWith("any-"), w[e2].push(((e3) => {
                            const t6 = [];
                            for (const s3 of e3) s3.name === _4 && t6.push(s3.node.text);
                            const r3 = (e4, t7) => t7 ? o2.test(e4) : !o2.test(e4);
                            return 0 === t6.length ? !s2 : a3 ? t6.every(((e4) => r3(e4, s2))) : t6.some(((e4) => r3(e4, s2)));
                          }));
                          break;
                        case "set!":
                          if (r2.length < 2 || r2.length > 3) throw new Error(`Wrong number of arguments to \`#set!\` predicate. Expected 1 or 2. Got ${r2.length - 1}.`);
                          if (r2.some(((e3) => "string" !== e3.type))) throw new Error('Arguments to `#set!` predicate must be a strings.".');
                          d[e2] || (d[e2] = {}), d[e2][r2[1].value] = r2[2] ? r2[2].value : null;
                          break;
                        case "is?":
                        case "is-not?":
                          if (r2.length < 2 || r2.length > 3) throw new Error(`Wrong number of arguments to \`#${t5}\` predicate. Expected 1 or 2. Got ${r2.length - 1}.`);
                          if (r2.some(((e3) => "string" !== e3.type))) throw new Error(`Arguments to \`#${t5}\` predicate must be a strings.".`);
                          const n2 = "is?" === t5 ? u : m;
                          n2[e2] || (n2[e2] = {}), n2[e2][r2[1].value] = r2[2] ? r2[2].value : null;
                          break;
                        case "not-any-of?":
                          s2 = false;
                        case "any-of?":
                          if (r2.length < 2) throw new Error(`Wrong number of arguments to \`#${t5}\` predicate. Expected at least 1. Got ${r2.length - 1}.`);
                          if ("capture" !== r2[1].type) throw new Error(`First argument of \`#${t5}\` predicate must be a capture. Got "${r2[1].value}".`);
                          for (let e3 = 2; e3 < r2.length; e3++) if ("string" !== r2[e3].type) throw new Error(`Arguments to \`#${t5}\` predicate must be a strings.".`);
                          _4 = r2[1].name;
                          const l2 = r2.slice(2).map(((e3) => e3.value));
                          w[e2].push(((e3) => {
                            const t6 = [];
                            for (const s3 of e3) s3.name === _4 && t6.push(s3.node.text);
                            return 0 === t6.length ? !s2 : t6.every(((e4) => l2.includes(e4))) === s2;
                          }));
                          break;
                        default:
                          c[e2].push({ operator: t5, operands: r2.slice(1) });
                      }
                      r2.length = 0;
                    }
                  }
                  Object.freeze(d[e2]), Object.freeze(u[e2]), Object.freeze(m[e2]);
                }
                return C._free(_), new Query(INTERNAL, s, n, w, c, Object.freeze(d), Object.freeze(u), Object.freeze(m));
              }
              static load(e) {
                let t;
                if (e instanceof Uint8Array) t = Promise.resolve(e);
                else {
                  const _ = e;
                  if ("undefined" != typeof process && process.versions && process.versions.node) {
                    const e2 = __require("fs");
                    t = Promise.resolve(e2.readFileSync(_));
                  } else t = fetch(_).then(((e2) => e2.arrayBuffer().then(((t2) => {
                    if (e2.ok) return new Uint8Array(t2);
                    {
                      const _2 = new TextDecoder("utf-8").decode(t2);
                      throw new Error(`Language.load failed with status ${e2.status}.

${_2}`);
                    }
                  }))));
                }
                return t.then(((e2) => loadWebAssemblyModule(e2, { loadAsync: true }))).then(((e2) => {
                  const t2 = Object.keys(e2), _ = t2.find(((e3) => LANGUAGE_FUNCTION_REGEX.test(e3) && !e3.includes("external_scanner_")));
                  _ || console.log(`Couldn't find language function in WASM file. Symbols:
${JSON.stringify(t2, null, 2)}`);
                  const s = e2[_]();
                  return new Language(INTERNAL, s);
                }));
              }
            }
            class LookaheadIterable {
              constructor(e, t, _) {
                assertInternal(e), this[0] = t, this.language = _;
              }
              get currentTypeId() {
                return C._ts_lookahead_iterator_current_symbol(this[0]);
              }
              get currentType() {
                return this.language.types[this.currentTypeId] || "ERROR";
              }
              delete() {
                C._ts_lookahead_iterator_delete(this[0]), this[0] = 0;
              }
              resetState(e) {
                return C._ts_lookahead_iterator_reset_state(this[0], e);
              }
              reset(e, t) {
                return !!C._ts_lookahead_iterator_reset(this[0], e[0], t) && (this.language = e, true);
              }
              [Symbol.iterator]() {
                const e = this;
                return { next: () => C._ts_lookahead_iterator_next(e[0]) ? { done: false, value: e.currentType } : { done: true, value: "" } };
              }
            }
            class Query {
              constructor(e, t, _, s, r, a, o, n) {
                assertInternal(e), this[0] = t, this.captureNames = _, this.textPredicates = s, this.predicates = r, this.setProperties = a, this.assertedProperties = o, this.refutedProperties = n, this.exceededMatchLimit = false;
              }
              delete() {
                C._ts_query_delete(this[0]), this[0] = 0;
              }
              matches(e, { startPosition: t = ZERO_POINT, endPosition: _ = ZERO_POINT, startIndex: s = 0, endIndex: r = 0, matchLimit: a = 4294967295, maxStartDepth: o = 4294967295 } = {}) {
                if ("number" != typeof a) throw new Error("Arguments must be numbers");
                marshalNode(e), C._ts_query_matches_wasm(this[0], e.tree[0], t.row, t.column, _.row, _.column, s, r, a, o);
                const n = getValue(TRANSFER_BUFFER, "i32"), l = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), d = getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32"), u = new Array(n);
                this.exceededMatchLimit = Boolean(d);
                let m = 0, c = l;
                for (let t2 = 0; t2 < n; t2++) {
                  const t3 = getValue(c, "i32");
                  c += SIZE_OF_INT;
                  const _2 = getValue(c, "i32");
                  c += SIZE_OF_INT;
                  const s2 = new Array(_2);
                  if (c = unmarshalCaptures(this, e.tree, c, s2), this.textPredicates[t3].every(((e2) => e2(s2)))) {
                    u[m] = { pattern: t3, captures: s2 };
                    const e2 = this.setProperties[t3];
                    e2 && (u[m].setProperties = e2);
                    const _3 = this.assertedProperties[t3];
                    _3 && (u[m].assertedProperties = _3);
                    const r2 = this.refutedProperties[t3];
                    r2 && (u[m].refutedProperties = r2), m++;
                  }
                }
                return u.length = m, C._free(l), u;
              }
              captures(e, { startPosition: t = ZERO_POINT, endPosition: _ = ZERO_POINT, startIndex: s = 0, endIndex: r = 0, matchLimit: a = 4294967295, maxStartDepth: o = 4294967295 } = {}) {
                if ("number" != typeof a) throw new Error("Arguments must be numbers");
                marshalNode(e), C._ts_query_captures_wasm(this[0], e.tree[0], t.row, t.column, _.row, _.column, s, r, a, o);
                const n = getValue(TRANSFER_BUFFER, "i32"), l = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), d = getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32"), u = [];
                this.exceededMatchLimit = Boolean(d);
                const m = [];
                let c = l;
                for (let t2 = 0; t2 < n; t2++) {
                  const t3 = getValue(c, "i32");
                  c += SIZE_OF_INT;
                  const _2 = getValue(c, "i32");
                  c += SIZE_OF_INT;
                  const s2 = getValue(c, "i32");
                  if (c += SIZE_OF_INT, m.length = _2, c = unmarshalCaptures(this, e.tree, c, m), this.textPredicates[t3].every(((e2) => e2(m)))) {
                    const e2 = m[s2], _3 = this.setProperties[t3];
                    _3 && (e2.setProperties = _3);
                    const r2 = this.assertedProperties[t3];
                    r2 && (e2.assertedProperties = r2);
                    const a2 = this.refutedProperties[t3];
                    a2 && (e2.refutedProperties = a2), u.push(e2);
                  }
                }
                return C._free(l), u;
              }
              predicatesForPattern(e) {
                return this.predicates[e];
              }
              disableCapture(e) {
                const t = lengthBytesUTF8(e), _ = C._malloc(t + 1);
                stringToUTF8(e, _, t + 1), C._ts_query_disable_capture(this[0], _, t), C._free(_);
              }
              didExceedMatchLimit() {
                return this.exceededMatchLimit;
              }
            }
            function getText(e, t, _) {
              const s = _ - t;
              let r = e.textCallback(t, null, _);
              for (t += r.length; t < _; ) {
                const s2 = e.textCallback(t, null, _);
                if (!(s2 && s2.length > 0)) break;
                t += s2.length, r += s2;
              }
              return t > _ && (r = r.slice(0, s)), r;
            }
            function unmarshalCaptures(e, t, _, s) {
              for (let r = 0, a = s.length; r < a; r++) {
                const a2 = getValue(_, "i32"), o = unmarshalNode(t, _ += SIZE_OF_INT);
                _ += SIZE_OF_NODE, s[r] = { name: e.captureNames[a2], node: o };
              }
              return _;
            }
            function assertInternal(e) {
              if (e !== INTERNAL) throw new Error("Illegal constructor");
            }
            function isPoint(e) {
              return e && "number" == typeof e.row && "number" == typeof e.column;
            }
            function marshalNode(e) {
              let t = TRANSFER_BUFFER;
              setValue(t, e.id, "i32"), t += SIZE_OF_INT, setValue(t, e.startIndex, "i32"), t += SIZE_OF_INT, setValue(t, e.startPosition.row, "i32"), t += SIZE_OF_INT, setValue(t, e.startPosition.column, "i32"), t += SIZE_OF_INT, setValue(t, e[0], "i32");
            }
            function unmarshalNode(e, t = TRANSFER_BUFFER) {
              const _ = getValue(t, "i32");
              if (0 === _) return null;
              const s = getValue(t += SIZE_OF_INT, "i32"), r = getValue(t += SIZE_OF_INT, "i32"), a = getValue(t += SIZE_OF_INT, "i32"), o = getValue(t += SIZE_OF_INT, "i32"), n = new Node(INTERNAL, e);
              return n.id = _, n.startIndex = s, n.startPosition = { row: r, column: a }, n[0] = o, n;
            }
            function marshalTreeCursor(e, t = TRANSFER_BUFFER) {
              setValue(t + 0 * SIZE_OF_INT, e[0], "i32"), setValue(t + 1 * SIZE_OF_INT, e[1], "i32"), setValue(t + 2 * SIZE_OF_INT, e[2], "i32"), setValue(t + 3 * SIZE_OF_INT, e[3], "i32");
            }
            function unmarshalTreeCursor(e) {
              e[0] = getValue(TRANSFER_BUFFER + 0 * SIZE_OF_INT, "i32"), e[1] = getValue(TRANSFER_BUFFER + 1 * SIZE_OF_INT, "i32"), e[2] = getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32"), e[3] = getValue(TRANSFER_BUFFER + 3 * SIZE_OF_INT, "i32");
            }
            function marshalPoint(e, t) {
              setValue(e, t.row, "i32"), setValue(e + SIZE_OF_INT, t.column, "i32");
            }
            function unmarshalPoint(e) {
              return { row: getValue(e, "i32") >>> 0, column: getValue(e + SIZE_OF_INT, "i32") >>> 0 };
            }
            function marshalRange(e, t) {
              marshalPoint(e, t.startPosition), marshalPoint(e += SIZE_OF_POINT, t.endPosition), setValue(e += SIZE_OF_POINT, t.startIndex, "i32"), setValue(e += SIZE_OF_INT, t.endIndex, "i32"), e += SIZE_OF_INT;
            }
            function unmarshalRange(e) {
              const t = {};
              return t.startPosition = unmarshalPoint(e), e += SIZE_OF_POINT, t.endPosition = unmarshalPoint(e), e += SIZE_OF_POINT, t.startIndex = getValue(e, "i32") >>> 0, e += SIZE_OF_INT, t.endIndex = getValue(e, "i32") >>> 0, t;
            }
            function marshalEdit(e) {
              let t = TRANSFER_BUFFER;
              marshalPoint(t, e.startPosition), t += SIZE_OF_POINT, marshalPoint(t, e.oldEndPosition), t += SIZE_OF_POINT, marshalPoint(t, e.newEndPosition), t += SIZE_OF_POINT, setValue(t, e.startIndex, "i32"), t += SIZE_OF_INT, setValue(t, e.oldEndIndex, "i32"), t += SIZE_OF_INT, setValue(t, e.newEndIndex, "i32"), t += SIZE_OF_INT;
            }
            for (const e of Object.getOwnPropertyNames(ParserImpl.prototype)) Object.defineProperty(Parser.prototype, e, { value: ParserImpl.prototype[e], enumerable: false, writable: false });
            Parser.Language = Language, Module.onRuntimeInitialized = () => {
              ParserImpl.init(), resolveInitPromise();
            };
          })));
        }
      }
      return Parser;
    })();
    "object" == typeof exports && (module.exports = TreeSitter);
  }
});

// node_modules/ignore/index.js
var require_ignore = __commonJS({
  "node_modules/ignore/index.js"(exports2, module2) {
    function makeArray(subject) {
      return Array.isArray(subject) ? subject : [subject];
    }
    var UNDEFINED = void 0;
    var EMPTY = "";
    var SPACE = " ";
    var ESCAPE = "\\";
    var REGEX_LITERAL_SPECIAL = /[.*+?()[\]{}^$|\\/]/;
    var REGEX_TEST_BLANK_LINE = /^\uFEFF? *$/;
    var REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
    var REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
    var REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
    var REGEX_SPLITALL_CRLF = /\r?\n/g;
    var DOUBLE_SLASH = "//";
    var SLASH_CODE = 47;
    var DOT_CODE = 46;
    var SLASH = "/";
    var TMP_KEY_IGNORE = "node-ignore";
    if (typeof Symbol !== "undefined") {
      TMP_KEY_IGNORE = /* @__PURE__ */ Symbol.for("node-ignore");
    }
    var KEY_IGNORE = TMP_KEY_IGNORE;
    var define = (object, key, value) => {
      Object.defineProperty(object, key, { value });
      return value;
    };
    var RETURN_FALSE = () => false;
    var cleanRangeBackSlash = (slashes) => {
      const { length } = slashes;
      return slashes.slice(0, length - length % 2);
    };
    var POSIX_CLASSES = {
      alnum: "0-9A-Za-z",
      alpha: "A-Za-z",
      blank: " \\t",
      cntrl: "\\x00-\\x1f\\x7f",
      digit: "0-9",
      graph: "!-.0-~",
      lower: "a-z",
      print: " -.0-~",
      punct: "!-.:-@\\[-`{-~",
      // git's `sane-ctype.h` classifies \v and \f as control, not space,
      //   unlike C's `isspace`
      space: " \\t\\n\\r",
      upper: "A-Z",
      xdigit: "0-9A-Fa-f"
    };
    var CLASS_MEMBERS_TO_ESCAPE = "\\]^-[";
    var escapeMember = (char) => CLASS_MEMBERS_TO_ESCAPE.indexOf(char) < 0 ? char : ESCAPE + char;
    var NON_SLASH = "(?!\\/)";
    var classSource = (negated, body2) => {
      if (negated) {
        return `[^\\/${body2}]`;
      }
      const source = `[${body2}]`;
      return new RegExp(source).test("/") ? NON_SLASH + source : source;
    };
    var scanBracket = (pattern, start2) => {
      const { length } = pattern;
      let index = start2 + 1;
      let negated = EMPTY;
      const lead = pattern[index];
      if (lead === "!" || lead === "^") {
        negated = "^";
        index++;
      }
      let body2 = EMPTY;
      let prev = EMPTY;
      for (; ; ) {
        const char = pattern[index];
        if (char === UNDEFINED) {
          return null;
        }
        if (char === ESCAPE) {
          const escaped = pattern[index + 1];
          if (escaped === UNDEFINED) {
            return null;
          }
          body2 += escapeMember(escaped);
          prev = escaped;
          index++;
        } else if (char === "-" && prev && index + 1 < length && pattern[index + 1] !== "]") {
          index++;
          let to = pattern[index];
          if (to === ESCAPE) {
            to = pattern[index += 1];
          }
          if (prev <= to) {
            body2 += `-${escapeMember(to)}`;
          }
          prev = EMPTY;
        } else if (char === "[" && pattern[index + 1] === ":") {
          const nameStart = index + 2;
          let end = nameStart;
          while (end < length && pattern[end] !== "]") {
            end++;
          }
          if (end === length) {
            return null;
          }
          if (end > nameStart && pattern[end - 1] === ":") {
            const expanded = POSIX_CLASSES[pattern.slice(nameStart, end - 1)];
            if (expanded === UNDEFINED) {
              return null;
            }
            body2 += expanded;
            prev = EMPTY;
            index = end;
          } else {
            body2 += escapeMember("[");
            prev = "[";
            index = nameStart - 2;
          }
        } else {
          body2 += escapeMember(char);
          prev = char;
        }
        index++;
        if (pattern[index] === "]") {
          return {
            end: index,
            source: classSource(negated, body2)
          };
        }
      }
    };
    var NEVER_MATCH = "[]";
    var PLACEHOLDER = "\0";
    var REGEX_RESTORE_PLACEHOLDER = new RegExp(
      `${PLACEHOLDER}(\\d+)${PLACEHOLDER}`,
      "g"
    );
    var TRAILING_WILDCARD = "\uE000";
    var extractBrackets = (pattern) => {
      const sources = [];
      const hold = (source) => `${PLACEHOLDER}${sources.push(source) - 1}${PLACEHOLDER}`;
      const { length } = pattern;
      let out2 = EMPTY;
      let index = 0;
      while (index < length) {
        const char = pattern[index];
        if (char === ESCAPE) {
          const escaped = pattern[index + 1];
          if (escaped === "*" || escaped === "[" || escaped === SPACE || escaped === ESCAPE) {
            out2 += pattern.slice(index, index + 2);
          } else {
            out2 += hold(
              REGEX_LITERAL_SPECIAL.test(escaped) ? ESCAPE + escaped : escaped
            );
          }
          index += 2;
        } else if (char === PLACEHOLDER) {
          out2 += hold(`[${PLACEHOLDER}]`);
          index++;
        } else if (char === "[") {
          const scanned = scanBracket(pattern, index);
          if (scanned === null) {
            out2 += hold(NEVER_MATCH);
            index = length;
          } else {
            out2 += hold(scanned.source);
            index = scanned.end + 1;
          }
        } else {
          out2 += char;
          index++;
        }
      }
      return {
        source: out2,
        sources
      };
    };
    var DIRECT = null;
    var REGEX_INNER_SLASH = /\/(?!$)/;
    var REPLACERS = [
      [
        // Remove BOM
        // TODO:
        // Other similar zero-width characters?
        /^\uFEFF/,
        () => EMPTY,
        "\uFEFF"
      ],
      [
        // A trailing line terminator, left on when a whole file's contents are
        //   added as one pattern rather than split into lines. git never sees one
        //   -- it reads a `.gitignore` line by line -- so it is not part of the
        //   pattern and is dropped here, apart from the trailing-space trimming,
        //   which follows git in touching spaces and nothing else.
        /[\r\n]+$/,
        () => EMPTY
      ],
      // > Trailing spaces are ignored unless they are quoted with backslash ("\")
      [
        // Only spaces, never tabs or other whitespace: git trims a trailing run
        //   of `' '` and nothing else (dir.c, `trim_trailing_spaces`, a single
        //   `case ' '`), so a pattern ending in a tab keeps it as a literal.
        // (a\ ) -> (a )
        // (a  ) -> (a)
        // (a ) -> (a)
        // (a \ ) -> (a  )
        /((?:\\\\)*?)(\\? +)$/,
        (_, m1, m2) => m1 + (m2.indexOf("\\") === 0 ? SPACE : EMPTY)
      ],
      // Replace (\ ) with ' '
      // Only a space: an escaped tab or other whitespace is already a literal by
      //   the time it reaches here, and a bare tab must be left as one, not turned
      //   into a space.
      // (\ ) -> ' '
      // (\\ ) -> '\\ '
      // (\\\ ) -> '\\ '
      [
        /(\\+?) /g,
        (_, m1) => {
          const { length } = m1;
          return m1.slice(0, length - length % 2) + SPACE;
        }
      ],
      // Escape metacharacters
      // which is written down by users but means special for regular expressions.
      // > There are 12 characters with special meanings:
      // > - the backslash \,
      // > - the caret ^,
      // > - the dollar sign $,
      // > - the period or dot .,
      // > - the vertical bar or pipe symbol |,
      // > - the question mark ?,
      // > - the asterisk or star *,
      // > - the plus sign +,
      // > - the opening parenthesis (,
      // > - the closing parenthesis ),
      // > - and the opening square bracket [,
      // > - the opening curly brace {,
      // > These special characters are often called "metacharacters".
      [
        /[\\$.|*+(){^]/g,
        (match) => `\\${match}`
      ],
      [
        // > a question mark (?) matches a single character
        /(?!\\)\?/g,
        () => "[^/]",
        "?"
      ],
      // leading slash
      [
        // > A leading slash matches the beginning of the pathname.
        // > For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
        // A leading slash matches the beginning of the pathname
        /^\//,
        () => "^",
        SLASH
      ],
      // replace special metacharacter slash after the leading slash
      [
        /\//g,
        () => "\\/",
        SLASH
      ],
      [
        // > A leading "**" followed by a slash means match in all directories.
        // > For example, "**/foo" matches file or directory "foo" anywhere,
        // > the same as pattern "foo".
        // > "**/foo/bar" matches file or directory "bar" anywhere that is directly
        // >   under directory "foo".
        // Notice that the '*'s have been replaced as '\\*'
        /^\^*(?:\\\*\\\*\\\/)+/,
        // '**/foo' <-> 'foo'
        () => "^(?:.*\\/)?",
        "*"
      ],
      // starting
      [
        // there will be no leading '/'
        //   (which has been replaced by section "leading slash")
        // If starts with '**', adding a '^' to the regular expression also works
        DIRECT,
        (source, pattern) => {
          if (!source || source[0] === "^") {
            return source;
          }
          const anchor = !REGEX_INNER_SLASH.test(pattern) ? "(?:^|\\/)" : "^";
          return anchor + source;
        }
      ],
      // two globstars
      [
        // Use lookahead assertions so that we could match more than one `'/**'`
        /\\\/\\\*\\\*(?=\\\/|$)/g,
        // Zero, one or several directories
        // should not use '*', or it will be replaced by the next replacer
        // Check if it is not the last `'/**'`
        (_, index, str) => index + 6 < str.length ? str.slice(index + 6) === "\\/" ? "(?:\\/[^\\/]+)+" : "(?:\\/[^\\/]+)*" : "\\/.+",
        "*"
      ],
      // normal intermediate wildcards
      [
        // Never replace escaped '*'
        // ignore rule '\*' will match the path '*'
        // 'abc.*/' -> go
        // 'abc.*'  -> skip this rule,
        //    coz trailing single wildcard will be handed by [trailing wildcard]
        /(^|[^\\]+)(\\\*)+(?=.+)/g,
        // '*.js' matches '.js'
        // '*.js' doesn't match 'abc'
        (_, p1, p2) => {
          const unescaped = p2.replace(/\\\*/g, "[^\\/]*");
          return p1 + unescaped;
        },
        "*"
      ],
      // trailing wildcard, held apart from a literal star
      [
        // The step above leaves a trailing `*` alone, so a single `\*` is all that
        //   can be left at the end here. Whether it is a wildcard or a literal
        //   turns on the backslashes the user put in front of it: the escaper has
        //   since doubled every one, so what stands here is those `2N` doubled
        //   backslashes and then the star's own escape. An even number of the
        //   original `N` leaves the star unescaped -- a wildcard -- and an odd
        //   number escapes it -- a literal. This runs while the two are still
        //   distinct, before the unescape steps below collapse the literal onto
        //   the very `\*` a wildcard leaves behind.
        /(^|[^\\])((?:\\\\)*)\\\*$/,
        (match, p1, p2) => (
          // `p2` holds the doubled user backslashes; half of them is `N`.
          p2.length / 2 % 2 === 0 ? p1 + p2 + TRAILING_WILDCARD : match
        ),
        "*"
      ],
      [
        // unescape, revert step 3 except for back slash
        // For example, if a user escape a '\\*',
        // after step 3, the result will be '\\\\\\*'
        /\\\\\\(?=[$.|*+(){^])/g,
        () => ESCAPE,
        ESCAPE + ESCAPE
      ],
      [
        // '\\\\' -> '\\'
        /\\\\/g,
        () => ESCAPE,
        ESCAPE + ESCAPE
      ],
      [
        // Every real bracket expression -- POSIX classes included -- has already
        //   been held aside by `extractBrackets`, so the only `[` left in the
        //   pattern is an escaped, literal one.
        // `\` is escaped by step 3
        /\\\[([^\]/]*?)(\\*)($|\])/g,
        // '\\[bar]' -> '\\\\[bar\\]'
        (match, range, endEscape, close) => `\\[${range}${cleanRangeBackSlash(endEscape)}${close}`,
        "["
      ],
      // ending
      [
        // 'js' will not match 'js.'
        // 'ab' will not match 'abc'
        DIRECT,
        // WTF!
        // https://git-scm.com/docs/gitignore
        // changes in [2.22.1](https://git-scm.com/docs/gitignore/2.22.1)
        // which re-fixes #24, #38
        // > If there is a separator at the end of the pattern then the pattern
        // > will only match directories, otherwise the pattern can match both
        // > files and directories.
        // 'js*' will not match 'a.js'
        // 'js/' will not match 'a.js'
        // 'js' will match 'a.js' and 'a.js/'
        (source) => {
          const last = source[source.length - 1];
          if (!last || last === TRAILING_WILDCARD) {
            return source;
          }
          return last === SLASH ? `${source}$` : `${source}(?=$|\\/$)`;
        }
      ]
    ];
    var REGEX_REPLACE_TRAILING_WILDCARD = /(^|\\\/)?\uE000$/;
    var MODE_IGNORE = "regex";
    var MODE_CHECK_IGNORE = "checkRegex";
    var UNDERSCORE = "_";
    var TRAILING_WILD_CARD_REPLACERS = {
      [MODE_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]+` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      },
      [MODE_CHECK_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]*` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      }
    };
    var WILDCARD = "[^\\/]*";
    var separatorAfter = (run2, at) => {
      let separator = EMPTY;
      for (let index = at + 1; index < run2.length && !run2[index].wildcard; index++) {
        separator += run2[index].single;
      }
      return separator;
    };
    var pinWildcards = (source) => {
      if (source.indexOf(WILDCARD) < 0) {
        return source;
      }
      const tokens2 = [];
      const { length } = source;
      let index = 0;
      while (index < length) {
        const char = source[index];
        if (source.startsWith(WILDCARD, index)) {
          tokens2.push({ wildcard: true });
          index += WILDCARD.length;
        } else if (char === "[") {
          let end = index + 1;
          if (source[end] === "^") {
            end++;
          }
          if (source[end] === "]") {
            end++;
          }
          while (end < length && source[end] !== "]") {
            end += source[end] === ESCAPE ? 2 : 1;
          }
          end++;
          tokens2.push({ single: source.slice(index, end) });
          index = end;
        } else if (char === ESCAPE) {
          tokens2.push({ single: source.slice(index, index + 2) });
          index += 2;
        } else if (char === "(") {
          let depth = 0;
          let end = index;
          do {
            if (source[end] === ESCAPE) {
              end++;
            } else if (source[end] === "(") {
              depth++;
            } else if (source[end] === ")") {
              depth--;
            }
            end++;
          } while (end < length && depth > 0);
          if ("*+?".indexOf(source[end]) >= 0) {
            end++;
          }
          tokens2.push({ boundary: source.slice(index, end) });
          index = end;
        } else if (char === "^" || char === "$") {
          tokens2.push({ boundary: char });
          index++;
        } else {
          tokens2.push({ single: char });
          index++;
        }
      }
      let out2 = EMPTY;
      let run2 = [];
      const flush = () => {
        let lastWildcard;
        run2.forEach((token, at) => {
          if (token.wildcard) {
            lastWildcard = at;
          }
        });
        run2.forEach((token, at) => {
          if (!token.wildcard) {
            out2 += token.single;
            return;
          }
          out2 += at === lastWildcard ? WILDCARD : `(?:(?!${separatorAfter(run2, at)})[^\\/])*`;
        });
        run2 = [];
      };
      tokens2.forEach((token) => {
        if (token.boundary === void 0) {
          run2.push(token);
          return;
        }
        flush();
        out2 += token.boundary;
      });
      flush();
      return out2;
    };
    var makeRegexPrefix = (pattern) => {
      const { source, sources } = extractBrackets(pattern);
      const replaced = REPLACERS.reduce(
        // A pass whose matcher finds nothing hands back the very string it was
        //   given, so asking first costs a search and saves a rewrite. Ten of the
        //   fifteen passes never fire for a typical .gitignore line, and between
        //   them they were 45% of this chain.
        (prev, [matcher, replacer, required]) => {
          if (matcher === DIRECT) {
            return replacer(prev, pattern);
          }
          if (required !== UNDEFINED && prev.indexOf(required) < 0) {
            return prev;
          }
          return matcher.test(prev) ? prev.replace(matcher, replacer.bind(pattern)) : prev;
        },
        source
      );
      return sources.length ? replaced.replace(
        REGEX_RESTORE_PLACEHOLDER,
        (match, index) => sources[index]
      ) : replaced;
    };
    var matchesBasename = (body2) => {
      const index = body2.indexOf(SLASH);
      return index < 0 || index === body2.length - 1;
    };
    var basenameOf = (path15) => {
      const end = path15.length - 1;
      const index = path15.lastIndexOf(
        SLASH,
        path15[end] === SLASH ? end - 1 : end
      );
      return index < 0 ? path15 : path15.slice(index + 1);
    };
    var parentOf = (path15) => {
      if (path15.charCodeAt(0) === SLASH_CODE || path15.indexOf(DOUBLE_SLASH) >= 0) {
        const slices = path15.split(SLASH).filter(Boolean);
        slices.pop();
        return slices.length ? slices.join(SLASH) + SLASH : EMPTY;
      }
      const end = path15.length - 1;
      const cut = path15.lastIndexOf(
        SLASH,
        path15.charCodeAt(end) === SLASH_CODE ? end - 1 : end
      );
      return cut < 0 ? EMPTY : path15.slice(0, cut + 1);
    };
    var isString = (subject) => typeof subject === "string";
    var checkPattern = (pattern) => pattern && isString(pattern) && !REGEX_TEST_BLANK_LINE.test(pattern) && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern) && pattern.indexOf("#") !== 0;
    var splitPattern = (pattern) => pattern.split(REGEX_SPLITALL_CRLF).filter(Boolean);
    var IgnoreRule = class {
      constructor(pattern, mark, body2, ignoreCase, negative, prefix) {
        this.pattern = pattern;
        this.mark = mark;
        this.negative = negative;
        define(this, "body", body2);
        define(this, "ignoreCase", ignoreCase);
        define(this, "regexPrefix", prefix);
      }
      // Worked out on first use and kept behind an own property, the way `regex`
      //   caches itself in `_regex`. Deciding it in the constructor instead would
      //   add a fourth `defineProperty` to every rule ever built, which cost 4% of
      //   every compile -- including the compiles of rules that are never matched
      //   against anything.
      get _basenameOnly() {
        return define(this, "_basenameOnly", matchesBasename(this.body));
      }
      get regex() {
        const key = UNDERSCORE + MODE_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_IGNORE, key);
      }
      get checkRegex() {
        const key = UNDERSCORE + MODE_CHECK_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_CHECK_IGNORE, key);
      }
      _make(mode, key) {
        const str = pinWildcards(this.regexPrefix.replace(
          REGEX_REPLACE_TRAILING_WILDCARD,
          // It does not need to bind pattern
          TRAILING_WILD_CARD_REPLACERS[mode]
        ));
        const regex = this.ignoreCase ? new RegExp(str, "i") : new RegExp(str);
        return define(this, key, regex);
      }
    };
    var createRule = ({
      pattern,
      mark
    }, ignoreCase) => {
      let negative = false;
      let body2 = pattern;
      if (body2.indexOf("!") === 0) {
        negative = true;
        body2 = body2.substr(1);
      }
      body2 = body2.replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, "!").replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, "#");
      const regexPrefix = makeRegexPrefix(body2);
      return new IgnoreRule(
        pattern,
        mark,
        body2,
        ignoreCase,
        negative,
        regexPrefix
      );
    };
    var RuleManager = class {
      constructor(ignoreCase) {
        this._ignoreCase = ignoreCase;
        this._rules = [];
        this._basenameCount = 0;
      }
      _add(pattern) {
        if (pattern && pattern[KEY_IGNORE]) {
          this._rules = this._rules.concat(pattern._rules._rules);
          this._basenameCount += pattern._rules._basenameCount;
          this._added = true;
          return;
        }
        if (isString(pattern)) {
          pattern = {
            pattern
          };
        }
        if (checkPattern(pattern.pattern)) {
          const rule = createRule(pattern, this._ignoreCase);
          this._added = true;
          this._rules.push(rule);
          if (matchesBasename(rule.body)) {
            this._basenameCount++;
          }
        }
      }
      // @param {Array<string> | string | Ignore} pattern
      add(pattern) {
        this._added = false;
        makeArray(
          isString(pattern) ? splitPattern(pattern) : pattern
        ).forEach(this._add, this);
        return this._added;
      }
      // Test one single path without recursively checking parent directories
      //
      // - checkUnignored `boolean` whether should check if the path is unignored,
      //   setting `checkUnignored` to `false` could reduce additional
      //   path matching.
      // - check `string` either `MODE_IGNORE` or `MODE_CHECK_IGNORE`
      // @returns {TestResult} true if a file is ignored
      test(path15, checkUnignored, mode) {
        let ignored2 = false;
        let unignored = false;
        let matchedRule;
        const rules = this._rules;
        const { length } = rules;
        const shortcut = this._basenameCount * 2 >= length;
        const basename = shortcut ? basenameOf(path15) : path15;
        for (let index = 0; index < length; index++) {
          const rule = rules[index];
          const { negative } = rule;
          const skip = unignored === negative && ignored2 !== unignored || negative && !ignored2 && !unignored && !checkUnignored;
          if (!skip && rule[mode].test(
            shortcut && rule._basenameOnly ? basename : path15
          )) {
            ignored2 = !negative;
            unignored = negative;
            matchedRule = negative ? UNDEFINED : rule;
          }
        }
        const ret = {
          ignored: ignored2,
          unignored
        };
        if (matchedRule) {
          ret.rule = matchedRule;
        }
        return ret;
      }
    };
    var throwError = (message, Ctor) => {
      throw new Ctor(message);
    };
    var checkPath = (path15, originalPath, doThrow) => {
      if (!isString(path15)) {
        return doThrow(
          `path must be a string, but got \`${originalPath}\``,
          TypeError
        );
      }
      if (!path15) {
        return doThrow(`path must not be empty`, TypeError);
      }
      if (checkPath.isNotRelative(path15)) {
        const r = "`path.relative()`d";
        return doThrow(
          `path should be a ${r} string, but got "${originalPath}"`,
          RangeError
        );
      }
      return true;
    };
    var isNotRelative = (path15) => {
      const first = path15.charCodeAt(0);
      if (first === SLASH_CODE) {
        return true;
      }
      if (first !== DOT_CODE) {
        return false;
      }
      if (path15.length === 1) {
        return true;
      }
      const second = path15.charCodeAt(1);
      if (second === SLASH_CODE) {
        return true;
      }
      if (second !== DOT_CODE) {
        return false;
      }
      return path15.length === 2 || path15.charCodeAt(2) === SLASH_CODE;
    };
    checkPath.isNotRelative = isNotRelative;
    checkPath.convert = (p) => p;
    var Ignore = class {
      constructor({
        ignorecase = true,
        ignoreCase = ignorecase,
        allowRelativePaths = false
      } = {}) {
        define(this, KEY_IGNORE, true);
        this._rules = new RuleManager(ignoreCase);
        this._strictPathCheck = !allowRelativePaths;
        this._initCache();
      }
      _initCache() {
        this._ignoreCache = /* @__PURE__ */ Object.create(null);
        this._testCache = /* @__PURE__ */ Object.create(null);
      }
      add(pattern) {
        if (this._rules.add(pattern)) {
          this._initCache();
        }
        return this;
      }
      // legacy
      addPattern(pattern) {
        return this.add(pattern);
      }
      // @returns {TestResult}
      _test(originalPath, cache, checkUnignored) {
        const path15 = originalPath && checkPath.convert(originalPath);
        checkPath(
          path15,
          originalPath,
          this._strictPathCheck ? throwError : RETURN_FALSE
        );
        return this._t(path15, cache, checkUnignored);
      }
      checkIgnore(path15) {
        if (path15.charCodeAt(path15.length - 1) !== SLASH_CODE) {
          return this.test(path15);
        }
        const parentPath = parentOf(path15);
        if (parentPath) {
          const parent = this._t(parentPath, this._testCache, true);
          if (parent.ignored) {
            return parent;
          }
        }
        return this._rules.test(path15, false, MODE_CHECK_IGNORE);
      }
      _t(path15, cache, checkUnignored) {
        if (path15 in cache) {
          return cache[path15];
        }
        const parentPath = parentOf(path15);
        const parent = parentPath ? this._t(parentPath, cache, checkUnignored) : UNDEFINED;
        return cache[path15] = parent && parent.ignored ? parent : this._rules.test(path15, checkUnignored, MODE_IGNORE);
      }
      ignores(path15) {
        return this._test(path15, this._ignoreCache, false).ignored;
      }
      createFilter() {
        return (path15) => !this.ignores(path15);
      }
      filter(paths) {
        return makeArray(paths).filter(this.createFilter());
      }
      // @returns {TestResult}
      test(path15) {
        return this._test(path15, this._testCache, true);
      }
    };
    var factory = (options) => new Ignore(options);
    var isPathValid = (path15) => checkPath(path15 && checkPath.convert(path15), path15, RETURN_FALSE);
    var setupWindows = () => {
      const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
      checkPath.convert = makePosix;
      const REGEX_TEST_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
      checkPath.isNotRelative = (path15) => REGEX_TEST_WINDOWS_PATH_ABSOLUTE.test(path15) || isNotRelative(path15);
    };
    if (
      // Detect `process` so that it can run in browsers.
      typeof process !== "undefined" && process.platform === "win32"
    ) {
      setupWindows();
    }
    module2.exports = factory;
    factory.default = factory;
    module2.exports.isPathValid = isPathValid;
    define(module2.exports, /* @__PURE__ */ Symbol.for("setupWindows"), setupWindows);
  }
});

// engine/src/cli.ts
import path14 from "node:path";
import { pathToFileURL } from "node:url";

// engine/src/pipeline.ts
import { execFileSync } from "node:child_process";
import fs6 from "node:fs";
import path13 from "node:path";

// engine/src/analyze.ts
import path4 from "node:path";

// node_modules/graphology/dist/graphology.mjs
import { EventEmitter } from "events";
function assignPolyfill() {
  const target = arguments[0];
  for (let i2 = 1, l = arguments.length; i2 < l; i2++) {
    if (!arguments[i2]) continue;
    for (const k in arguments[i2]) target[k] = arguments[i2][k];
  }
  return target;
}
var assign = assignPolyfill;
if (typeof Object.assign === "function") assign = Object.assign;
function getMatchingEdge(graph, source, target, type) {
  const sourceData = graph._nodes.get(source);
  let edge2 = null;
  if (!sourceData) return edge2;
  if (type === "mixed") {
    edge2 = sourceData.out && sourceData.out[target] || sourceData.undirected && sourceData.undirected[target];
  } else if (type === "directed") {
    edge2 = sourceData.out && sourceData.out[target];
  } else {
    edge2 = sourceData.undirected && sourceData.undirected[target];
  }
  return edge2;
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null;
}
function isEmpty(o) {
  let k;
  for (k in o) return false;
  return true;
}
function privateProperty(target, name2, value) {
  Object.defineProperty(target, name2, {
    enumerable: false,
    configurable: false,
    writable: true,
    value
  });
}
function readOnlyProperty(target, name2, value) {
  const descriptor = {
    enumerable: true,
    configurable: true
  };
  if (typeof value === "function") {
    descriptor.get = value;
  } else {
    descriptor.value = value;
    descriptor.writable = false;
  }
  Object.defineProperty(target, name2, descriptor);
}
function validateHints(hints) {
  if (!isPlainObject(hints)) return false;
  if (hints.attributes && !Array.isArray(hints.attributes)) return false;
  return true;
}
function incrementalIdStartingFromRandomByte() {
  let i2 = Math.floor(Math.random() * 256) & 255;
  return () => {
    return i2++;
  };
}
function chain() {
  const iterables = arguments;
  let current = null;
  let i2 = -1;
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      let step = null;
      do {
        if (current === null) {
          i2++;
          if (i2 >= iterables.length) return { done: true };
          current = iterables[i2][Symbol.iterator]();
        }
        step = current.next();
        if (step.done) {
          current = null;
          continue;
        }
        break;
      } while (true);
      return step;
    }
  };
}
function emptyIterator() {
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      return { done: true };
    }
  };
}
var GraphError = class extends Error {
  constructor(message) {
    super();
    this.name = "GraphError";
    this.message = message;
  }
};
var InvalidArgumentsGraphError = class _InvalidArgumentsGraphError extends GraphError {
  constructor(message) {
    super(message);
    this.name = "InvalidArgumentsGraphError";
    if (typeof Error.captureStackTrace === "function")
      Error.captureStackTrace(
        this,
        _InvalidArgumentsGraphError.prototype.constructor
      );
  }
};
var NotFoundGraphError = class _NotFoundGraphError extends GraphError {
  constructor(message) {
    super(message);
    this.name = "NotFoundGraphError";
    if (typeof Error.captureStackTrace === "function")
      Error.captureStackTrace(this, _NotFoundGraphError.prototype.constructor);
  }
};
var UsageGraphError = class _UsageGraphError extends GraphError {
  constructor(message) {
    super(message);
    this.name = "UsageGraphError";
    if (typeof Error.captureStackTrace === "function")
      Error.captureStackTrace(this, _UsageGraphError.prototype.constructor);
  }
};
function MixedNodeData(key, attributes) {
  this.key = key;
  this.attributes = attributes;
  this.clear();
}
MixedNodeData.prototype.clear = function() {
  this.inDegree = 0;
  this.outDegree = 0;
  this.undirectedDegree = 0;
  this.undirectedLoops = 0;
  this.directedLoops = 0;
  this.in = {};
  this.out = {};
  this.undirected = {};
};
function DirectedNodeData(key, attributes) {
  this.key = key;
  this.attributes = attributes;
  this.clear();
}
DirectedNodeData.prototype.clear = function() {
  this.inDegree = 0;
  this.outDegree = 0;
  this.directedLoops = 0;
  this.in = {};
  this.out = {};
};
function UndirectedNodeData(key, attributes) {
  this.key = key;
  this.attributes = attributes;
  this.clear();
}
UndirectedNodeData.prototype.clear = function() {
  this.undirectedDegree = 0;
  this.undirectedLoops = 0;
  this.undirected = {};
};
function EdgeData(undirected, key, source, target, attributes) {
  this.key = key;
  this.attributes = attributes;
  this.undirected = undirected;
  this.source = source;
  this.target = target;
}
EdgeData.prototype.attach = function() {
  let outKey = "out";
  let inKey = "in";
  if (this.undirected) outKey = inKey = "undirected";
  const source = this.source.key;
  const target = this.target.key;
  this.source[outKey][target] = this;
  if (this.undirected && source === target) return;
  this.target[inKey][source] = this;
};
EdgeData.prototype.attachMulti = function() {
  let outKey = "out";
  let inKey = "in";
  const source = this.source.key;
  const target = this.target.key;
  if (this.undirected) outKey = inKey = "undirected";
  const adj = this.source[outKey];
  const head = adj[target];
  if (typeof head === "undefined") {
    adj[target] = this;
    if (!(this.undirected && source === target)) {
      this.target[inKey][source] = this;
    }
    return;
  }
  head.previous = this;
  this.next = head;
  adj[target] = this;
  this.target[inKey][source] = this;
};
EdgeData.prototype.detach = function() {
  const source = this.source.key;
  const target = this.target.key;
  let outKey = "out";
  let inKey = "in";
  if (this.undirected) outKey = inKey = "undirected";
  delete this.source[outKey][target];
  delete this.target[inKey][source];
};
EdgeData.prototype.detachMulti = function() {
  const source = this.source.key;
  const target = this.target.key;
  let outKey = "out";
  let inKey = "in";
  if (this.undirected) outKey = inKey = "undirected";
  if (this.previous === void 0) {
    if (this.next === void 0) {
      delete this.source[outKey][target];
      delete this.target[inKey][source];
    } else {
      this.next.previous = void 0;
      this.source[outKey][target] = this.next;
      this.target[inKey][source] = this.next;
    }
  } else {
    this.previous.next = this.next;
    if (this.next !== void 0) {
      this.next.previous = this.previous;
    }
  }
};
var NODE = 0;
var SOURCE = 1;
var TARGET = 2;
var OPPOSITE = 3;
function findRelevantNodeData(graph, method, mode, nodeOrEdge, nameOrEdge, add1, add2) {
  let nodeData, edgeData, arg1, arg2;
  nodeOrEdge = "" + nodeOrEdge;
  if (mode === NODE) {
    nodeData = graph._nodes.get(nodeOrEdge);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.${method}: could not find the "${nodeOrEdge}" node in the graph.`
      );
    arg1 = nameOrEdge;
    arg2 = add1;
  } else if (mode === OPPOSITE) {
    nameOrEdge = "" + nameOrEdge;
    edgeData = graph._edges.get(nameOrEdge);
    if (!edgeData)
      throw new NotFoundGraphError(
        `Graph.${method}: could not find the "${nameOrEdge}" edge in the graph.`
      );
    const source = edgeData.source.key;
    const target = edgeData.target.key;
    if (nodeOrEdge === source) {
      nodeData = edgeData.target;
    } else if (nodeOrEdge === target) {
      nodeData = edgeData.source;
    } else {
      throw new NotFoundGraphError(
        `Graph.${method}: the "${nodeOrEdge}" node is not attached to the "${nameOrEdge}" edge (${source}, ${target}).`
      );
    }
    arg1 = add1;
    arg2 = add2;
  } else {
    edgeData = graph._edges.get(nodeOrEdge);
    if (!edgeData)
      throw new NotFoundGraphError(
        `Graph.${method}: could not find the "${nodeOrEdge}" edge in the graph.`
      );
    if (mode === SOURCE) {
      nodeData = edgeData.source;
    } else {
      nodeData = edgeData.target;
    }
    arg1 = nameOrEdge;
    arg2 = add1;
  }
  return [nodeData, arg1, arg2];
}
function attachNodeAttributeGetter(Class, method, mode) {
  Class.prototype[method] = function(nodeOrEdge, nameOrEdge, add1) {
    const [data, name2] = findRelevantNodeData(
      this,
      method,
      mode,
      nodeOrEdge,
      nameOrEdge,
      add1
    );
    return data.attributes[name2];
  };
}
function attachNodeAttributesGetter(Class, method, mode) {
  Class.prototype[method] = function(nodeOrEdge, nameOrEdge) {
    const [data] = findRelevantNodeData(
      this,
      method,
      mode,
      nodeOrEdge,
      nameOrEdge
    );
    return data.attributes;
  };
}
function attachNodeAttributeChecker(Class, method, mode) {
  Class.prototype[method] = function(nodeOrEdge, nameOrEdge, add1) {
    const [data, name2] = findRelevantNodeData(
      this,
      method,
      mode,
      nodeOrEdge,
      nameOrEdge,
      add1
    );
    return data.attributes.hasOwnProperty(name2);
  };
}
function attachNodeAttributeSetter(Class, method, mode) {
  Class.prototype[method] = function(nodeOrEdge, nameOrEdge, add1, add2) {
    const [data, name2, value] = findRelevantNodeData(
      this,
      method,
      mode,
      nodeOrEdge,
      nameOrEdge,
      add1,
      add2
    );
    data.attributes[name2] = value;
    this.emit("nodeAttributesUpdated", {
      key: data.key,
      type: "set",
      attributes: data.attributes,
      name: name2
    });
    return this;
  };
}
function attachNodeAttributeUpdater(Class, method, mode) {
  Class.prototype[method] = function(nodeOrEdge, nameOrEdge, add1, add2) {
    const [data, name2, updater] = findRelevantNodeData(
      this,
      method,
      mode,
      nodeOrEdge,
      nameOrEdge,
      add1,
      add2
    );
    if (typeof updater !== "function")
      throw new InvalidArgumentsGraphError(
        `Graph.${method}: updater should be a function.`
      );
    const attributes = data.attributes;
    const value = updater(attributes[name2]);
    attributes[name2] = value;
    this.emit("nodeAttributesUpdated", {
      key: data.key,
      type: "set",
      attributes: data.attributes,
      name: name2
    });
    return this;
  };
}
function attachNodeAttributeRemover(Class, method, mode) {
  Class.prototype[method] = function(nodeOrEdge, nameOrEdge, add1) {
    const [data, name2] = findRelevantNodeData(
      this,
      method,
      mode,
      nodeOrEdge,
      nameOrEdge,
      add1
    );
    delete data.attributes[name2];
    this.emit("nodeAttributesUpdated", {
      key: data.key,
      type: "remove",
      attributes: data.attributes,
      name: name2
    });
    return this;
  };
}
function attachNodeAttributesReplacer(Class, method, mode) {
  Class.prototype[method] = function(nodeOrEdge, nameOrEdge, add1) {
    const [data, attributes] = findRelevantNodeData(
      this,
      method,
      mode,
      nodeOrEdge,
      nameOrEdge,
      add1
    );
    if (!isPlainObject(attributes))
      throw new InvalidArgumentsGraphError(
        `Graph.${method}: provided attributes are not a plain object.`
      );
    data.attributes = attributes;
    this.emit("nodeAttributesUpdated", {
      key: data.key,
      type: "replace",
      attributes: data.attributes
    });
    return this;
  };
}
function attachNodeAttributesMerger(Class, method, mode) {
  Class.prototype[method] = function(nodeOrEdge, nameOrEdge, add1) {
    const [data, attributes] = findRelevantNodeData(
      this,
      method,
      mode,
      nodeOrEdge,
      nameOrEdge,
      add1
    );
    if (!isPlainObject(attributes))
      throw new InvalidArgumentsGraphError(
        `Graph.${method}: provided attributes are not a plain object.`
      );
    assign(data.attributes, attributes);
    this.emit("nodeAttributesUpdated", {
      key: data.key,
      type: "merge",
      attributes: data.attributes,
      data: attributes
    });
    return this;
  };
}
function attachNodeAttributesUpdater(Class, method, mode) {
  Class.prototype[method] = function(nodeOrEdge, nameOrEdge, add1) {
    const [data, updater] = findRelevantNodeData(
      this,
      method,
      mode,
      nodeOrEdge,
      nameOrEdge,
      add1
    );
    if (typeof updater !== "function")
      throw new InvalidArgumentsGraphError(
        `Graph.${method}: provided updater is not a function.`
      );
    data.attributes = updater(data.attributes);
    this.emit("nodeAttributesUpdated", {
      key: data.key,
      type: "update",
      attributes: data.attributes
    });
    return this;
  };
}
var NODE_ATTRIBUTES_METHODS = [
  {
    name: (element) => `get${element}Attribute`,
    attacher: attachNodeAttributeGetter
  },
  {
    name: (element) => `get${element}Attributes`,
    attacher: attachNodeAttributesGetter
  },
  {
    name: (element) => `has${element}Attribute`,
    attacher: attachNodeAttributeChecker
  },
  {
    name: (element) => `set${element}Attribute`,
    attacher: attachNodeAttributeSetter
  },
  {
    name: (element) => `update${element}Attribute`,
    attacher: attachNodeAttributeUpdater
  },
  {
    name: (element) => `remove${element}Attribute`,
    attacher: attachNodeAttributeRemover
  },
  {
    name: (element) => `replace${element}Attributes`,
    attacher: attachNodeAttributesReplacer
  },
  {
    name: (element) => `merge${element}Attributes`,
    attacher: attachNodeAttributesMerger
  },
  {
    name: (element) => `update${element}Attributes`,
    attacher: attachNodeAttributesUpdater
  }
];
function attachNodeAttributesMethods(Graph3) {
  NODE_ATTRIBUTES_METHODS.forEach(function({ name: name2, attacher }) {
    attacher(Graph3, name2("Node"), NODE);
    attacher(Graph3, name2("Source"), SOURCE);
    attacher(Graph3, name2("Target"), TARGET);
    attacher(Graph3, name2("Opposite"), OPPOSITE);
  });
}
function attachEdgeAttributeGetter(Class, method, type) {
  Class.prototype[method] = function(element, name2) {
    let data;
    if (this.type !== "mixed" && type !== "mixed" && type !== this.type)
      throw new UsageGraphError(
        `Graph.${method}: cannot find this type of edges in your ${this.type} graph.`
      );
    if (arguments.length > 2) {
      if (this.multi)
        throw new UsageGraphError(
          `Graph.${method}: cannot use a {source,target} combo when asking about an edge's attributes in a MultiGraph since we cannot infer the one you want information about.`
        );
      const source = "" + element;
      const target = "" + name2;
      name2 = arguments[2];
      data = getMatchingEdge(this, source, target, type);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find an edge for the given path ("${source}" - "${target}").`
        );
    } else {
      if (type !== "mixed")
        throw new UsageGraphError(
          `Graph.${method}: calling this method with only a key (vs. a source and target) does not make sense since an edge with this key could have the other type.`
        );
      element = "" + element;
      data = this._edges.get(element);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find the "${element}" edge in the graph.`
        );
    }
    return data.attributes[name2];
  };
}
function attachEdgeAttributesGetter(Class, method, type) {
  Class.prototype[method] = function(element) {
    let data;
    if (this.type !== "mixed" && type !== "mixed" && type !== this.type)
      throw new UsageGraphError(
        `Graph.${method}: cannot find this type of edges in your ${this.type} graph.`
      );
    if (arguments.length > 1) {
      if (this.multi)
        throw new UsageGraphError(
          `Graph.${method}: cannot use a {source,target} combo when asking about an edge's attributes in a MultiGraph since we cannot infer the one you want information about.`
        );
      const source = "" + element, target = "" + arguments[1];
      data = getMatchingEdge(this, source, target, type);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find an edge for the given path ("${source}" - "${target}").`
        );
    } else {
      if (type !== "mixed")
        throw new UsageGraphError(
          `Graph.${method}: calling this method with only a key (vs. a source and target) does not make sense since an edge with this key could have the other type.`
        );
      element = "" + element;
      data = this._edges.get(element);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find the "${element}" edge in the graph.`
        );
    }
    return data.attributes;
  };
}
function attachEdgeAttributeChecker(Class, method, type) {
  Class.prototype[method] = function(element, name2) {
    let data;
    if (this.type !== "mixed" && type !== "mixed" && type !== this.type)
      throw new UsageGraphError(
        `Graph.${method}: cannot find this type of edges in your ${this.type} graph.`
      );
    if (arguments.length > 2) {
      if (this.multi)
        throw new UsageGraphError(
          `Graph.${method}: cannot use a {source,target} combo when asking about an edge's attributes in a MultiGraph since we cannot infer the one you want information about.`
        );
      const source = "" + element;
      const target = "" + name2;
      name2 = arguments[2];
      data = getMatchingEdge(this, source, target, type);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find an edge for the given path ("${source}" - "${target}").`
        );
    } else {
      if (type !== "mixed")
        throw new UsageGraphError(
          `Graph.${method}: calling this method with only a key (vs. a source and target) does not make sense since an edge with this key could have the other type.`
        );
      element = "" + element;
      data = this._edges.get(element);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find the "${element}" edge in the graph.`
        );
    }
    return data.attributes.hasOwnProperty(name2);
  };
}
function attachEdgeAttributeSetter(Class, method, type) {
  Class.prototype[method] = function(element, name2, value) {
    let data;
    if (this.type !== "mixed" && type !== "mixed" && type !== this.type)
      throw new UsageGraphError(
        `Graph.${method}: cannot find this type of edges in your ${this.type} graph.`
      );
    if (arguments.length > 3) {
      if (this.multi)
        throw new UsageGraphError(
          `Graph.${method}: cannot use a {source,target} combo when asking about an edge's attributes in a MultiGraph since we cannot infer the one you want information about.`
        );
      const source = "" + element;
      const target = "" + name2;
      name2 = arguments[2];
      value = arguments[3];
      data = getMatchingEdge(this, source, target, type);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find an edge for the given path ("${source}" - "${target}").`
        );
    } else {
      if (type !== "mixed")
        throw new UsageGraphError(
          `Graph.${method}: calling this method with only a key (vs. a source and target) does not make sense since an edge with this key could have the other type.`
        );
      element = "" + element;
      data = this._edges.get(element);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find the "${element}" edge in the graph.`
        );
    }
    data.attributes[name2] = value;
    this.emit("edgeAttributesUpdated", {
      key: data.key,
      type: "set",
      attributes: data.attributes,
      name: name2
    });
    return this;
  };
}
function attachEdgeAttributeUpdater(Class, method, type) {
  Class.prototype[method] = function(element, name2, updater) {
    let data;
    if (this.type !== "mixed" && type !== "mixed" && type !== this.type)
      throw new UsageGraphError(
        `Graph.${method}: cannot find this type of edges in your ${this.type} graph.`
      );
    if (arguments.length > 3) {
      if (this.multi)
        throw new UsageGraphError(
          `Graph.${method}: cannot use a {source,target} combo when asking about an edge's attributes in a MultiGraph since we cannot infer the one you want information about.`
        );
      const source = "" + element;
      const target = "" + name2;
      name2 = arguments[2];
      updater = arguments[3];
      data = getMatchingEdge(this, source, target, type);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find an edge for the given path ("${source}" - "${target}").`
        );
    } else {
      if (type !== "mixed")
        throw new UsageGraphError(
          `Graph.${method}: calling this method with only a key (vs. a source and target) does not make sense since an edge with this key could have the other type.`
        );
      element = "" + element;
      data = this._edges.get(element);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find the "${element}" edge in the graph.`
        );
    }
    if (typeof updater !== "function")
      throw new InvalidArgumentsGraphError(
        `Graph.${method}: updater should be a function.`
      );
    data.attributes[name2] = updater(data.attributes[name2]);
    this.emit("edgeAttributesUpdated", {
      key: data.key,
      type: "set",
      attributes: data.attributes,
      name: name2
    });
    return this;
  };
}
function attachEdgeAttributeRemover(Class, method, type) {
  Class.prototype[method] = function(element, name2) {
    let data;
    if (this.type !== "mixed" && type !== "mixed" && type !== this.type)
      throw new UsageGraphError(
        `Graph.${method}: cannot find this type of edges in your ${this.type} graph.`
      );
    if (arguments.length > 2) {
      if (this.multi)
        throw new UsageGraphError(
          `Graph.${method}: cannot use a {source,target} combo when asking about an edge's attributes in a MultiGraph since we cannot infer the one you want information about.`
        );
      const source = "" + element;
      const target = "" + name2;
      name2 = arguments[2];
      data = getMatchingEdge(this, source, target, type);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find an edge for the given path ("${source}" - "${target}").`
        );
    } else {
      if (type !== "mixed")
        throw new UsageGraphError(
          `Graph.${method}: calling this method with only a key (vs. a source and target) does not make sense since an edge with this key could have the other type.`
        );
      element = "" + element;
      data = this._edges.get(element);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find the "${element}" edge in the graph.`
        );
    }
    delete data.attributes[name2];
    this.emit("edgeAttributesUpdated", {
      key: data.key,
      type: "remove",
      attributes: data.attributes,
      name: name2
    });
    return this;
  };
}
function attachEdgeAttributesReplacer(Class, method, type) {
  Class.prototype[method] = function(element, attributes) {
    let data;
    if (this.type !== "mixed" && type !== "mixed" && type !== this.type)
      throw new UsageGraphError(
        `Graph.${method}: cannot find this type of edges in your ${this.type} graph.`
      );
    if (arguments.length > 2) {
      if (this.multi)
        throw new UsageGraphError(
          `Graph.${method}: cannot use a {source,target} combo when asking about an edge's attributes in a MultiGraph since we cannot infer the one you want information about.`
        );
      const source = "" + element, target = "" + attributes;
      attributes = arguments[2];
      data = getMatchingEdge(this, source, target, type);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find an edge for the given path ("${source}" - "${target}").`
        );
    } else {
      if (type !== "mixed")
        throw new UsageGraphError(
          `Graph.${method}: calling this method with only a key (vs. a source and target) does not make sense since an edge with this key could have the other type.`
        );
      element = "" + element;
      data = this._edges.get(element);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find the "${element}" edge in the graph.`
        );
    }
    if (!isPlainObject(attributes))
      throw new InvalidArgumentsGraphError(
        `Graph.${method}: provided attributes are not a plain object.`
      );
    data.attributes = attributes;
    this.emit("edgeAttributesUpdated", {
      key: data.key,
      type: "replace",
      attributes: data.attributes
    });
    return this;
  };
}
function attachEdgeAttributesMerger(Class, method, type) {
  Class.prototype[method] = function(element, attributes) {
    let data;
    if (this.type !== "mixed" && type !== "mixed" && type !== this.type)
      throw new UsageGraphError(
        `Graph.${method}: cannot find this type of edges in your ${this.type} graph.`
      );
    if (arguments.length > 2) {
      if (this.multi)
        throw new UsageGraphError(
          `Graph.${method}: cannot use a {source,target} combo when asking about an edge's attributes in a MultiGraph since we cannot infer the one you want information about.`
        );
      const source = "" + element, target = "" + attributes;
      attributes = arguments[2];
      data = getMatchingEdge(this, source, target, type);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find an edge for the given path ("${source}" - "${target}").`
        );
    } else {
      if (type !== "mixed")
        throw new UsageGraphError(
          `Graph.${method}: calling this method with only a key (vs. a source and target) does not make sense since an edge with this key could have the other type.`
        );
      element = "" + element;
      data = this._edges.get(element);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find the "${element}" edge in the graph.`
        );
    }
    if (!isPlainObject(attributes))
      throw new InvalidArgumentsGraphError(
        `Graph.${method}: provided attributes are not a plain object.`
      );
    assign(data.attributes, attributes);
    this.emit("edgeAttributesUpdated", {
      key: data.key,
      type: "merge",
      attributes: data.attributes,
      data: attributes
    });
    return this;
  };
}
function attachEdgeAttributesUpdater(Class, method, type) {
  Class.prototype[method] = function(element, updater) {
    let data;
    if (this.type !== "mixed" && type !== "mixed" && type !== this.type)
      throw new UsageGraphError(
        `Graph.${method}: cannot find this type of edges in your ${this.type} graph.`
      );
    if (arguments.length > 2) {
      if (this.multi)
        throw new UsageGraphError(
          `Graph.${method}: cannot use a {source,target} combo when asking about an edge's attributes in a MultiGraph since we cannot infer the one you want information about.`
        );
      const source = "" + element, target = "" + updater;
      updater = arguments[2];
      data = getMatchingEdge(this, source, target, type);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find an edge for the given path ("${source}" - "${target}").`
        );
    } else {
      if (type !== "mixed")
        throw new UsageGraphError(
          `Graph.${method}: calling this method with only a key (vs. a source and target) does not make sense since an edge with this key could have the other type.`
        );
      element = "" + element;
      data = this._edges.get(element);
      if (!data)
        throw new NotFoundGraphError(
          `Graph.${method}: could not find the "${element}" edge in the graph.`
        );
    }
    if (typeof updater !== "function")
      throw new InvalidArgumentsGraphError(
        `Graph.${method}: provided updater is not a function.`
      );
    data.attributes = updater(data.attributes);
    this.emit("edgeAttributesUpdated", {
      key: data.key,
      type: "update",
      attributes: data.attributes
    });
    return this;
  };
}
var EDGE_ATTRIBUTES_METHODS = [
  {
    name: (element) => `get${element}Attribute`,
    attacher: attachEdgeAttributeGetter
  },
  {
    name: (element) => `get${element}Attributes`,
    attacher: attachEdgeAttributesGetter
  },
  {
    name: (element) => `has${element}Attribute`,
    attacher: attachEdgeAttributeChecker
  },
  {
    name: (element) => `set${element}Attribute`,
    attacher: attachEdgeAttributeSetter
  },
  {
    name: (element) => `update${element}Attribute`,
    attacher: attachEdgeAttributeUpdater
  },
  {
    name: (element) => `remove${element}Attribute`,
    attacher: attachEdgeAttributeRemover
  },
  {
    name: (element) => `replace${element}Attributes`,
    attacher: attachEdgeAttributesReplacer
  },
  {
    name: (element) => `merge${element}Attributes`,
    attacher: attachEdgeAttributesMerger
  },
  {
    name: (element) => `update${element}Attributes`,
    attacher: attachEdgeAttributesUpdater
  }
];
function attachEdgeAttributesMethods(Graph3) {
  EDGE_ATTRIBUTES_METHODS.forEach(function({ name: name2, attacher }) {
    attacher(Graph3, name2("Edge"), "mixed");
    attacher(Graph3, name2("DirectedEdge"), "directed");
    attacher(Graph3, name2("UndirectedEdge"), "undirected");
  });
}
var EDGES_ITERATION = [
  {
    name: "edges",
    type: "mixed"
  },
  {
    name: "inEdges",
    type: "directed",
    direction: "in"
  },
  {
    name: "outEdges",
    type: "directed",
    direction: "out"
  },
  {
    name: "inboundEdges",
    type: "mixed",
    direction: "in"
  },
  {
    name: "outboundEdges",
    type: "mixed",
    direction: "out"
  },
  {
    name: "directedEdges",
    type: "directed"
  },
  {
    name: "undirectedEdges",
    type: "undirected"
  }
];
function forEachSimple(breakable, object, callback, avoid) {
  let shouldBreak = false;
  for (const k in object) {
    if (k === avoid) continue;
    const edgeData = object[k];
    shouldBreak = callback(
      edgeData.key,
      edgeData.attributes,
      edgeData.source.key,
      edgeData.target.key,
      edgeData.source.attributes,
      edgeData.target.attributes,
      edgeData.undirected
    );
    if (breakable && shouldBreak) return edgeData.key;
  }
  return;
}
function forEachMulti(breakable, object, callback, avoid) {
  let edgeData, source, target;
  let shouldBreak = false;
  for (const k in object) {
    if (k === avoid) continue;
    edgeData = object[k];
    do {
      source = edgeData.source;
      target = edgeData.target;
      shouldBreak = callback(
        edgeData.key,
        edgeData.attributes,
        source.key,
        target.key,
        source.attributes,
        target.attributes,
        edgeData.undirected
      );
      if (breakable && shouldBreak) return edgeData.key;
      edgeData = edgeData.next;
    } while (edgeData !== void 0);
  }
  return;
}
function createIterator(object, avoid) {
  const keys = Object.keys(object);
  const l = keys.length;
  let edgeData;
  let i2 = 0;
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      do {
        if (!edgeData) {
          if (i2 >= l) return { done: true };
          const k = keys[i2++];
          if (k === avoid) {
            edgeData = void 0;
            continue;
          }
          edgeData = object[k];
        } else {
          edgeData = edgeData.next;
        }
      } while (!edgeData);
      return {
        done: false,
        value: {
          edge: edgeData.key,
          attributes: edgeData.attributes,
          source: edgeData.source.key,
          target: edgeData.target.key,
          sourceAttributes: edgeData.source.attributes,
          targetAttributes: edgeData.target.attributes,
          undirected: edgeData.undirected
        }
      };
    }
  };
}
function forEachForKeySimple(breakable, object, k, callback) {
  const edgeData = object[k];
  if (!edgeData) return;
  const sourceData = edgeData.source;
  const targetData = edgeData.target;
  if (callback(
    edgeData.key,
    edgeData.attributes,
    sourceData.key,
    targetData.key,
    sourceData.attributes,
    targetData.attributes,
    edgeData.undirected
  ) && breakable)
    return edgeData.key;
}
function forEachForKeyMulti(breakable, object, k, callback) {
  let edgeData = object[k];
  if (!edgeData) return;
  let shouldBreak = false;
  do {
    shouldBreak = callback(
      edgeData.key,
      edgeData.attributes,
      edgeData.source.key,
      edgeData.target.key,
      edgeData.source.attributes,
      edgeData.target.attributes,
      edgeData.undirected
    );
    if (breakable && shouldBreak) return edgeData.key;
    edgeData = edgeData.next;
  } while (edgeData !== void 0);
  return;
}
function createIteratorForKey(object, k) {
  let edgeData = object[k];
  if (edgeData.next !== void 0) {
    return {
      [Symbol.iterator]() {
        return this;
      },
      next() {
        if (!edgeData) return { done: true };
        const value = {
          edge: edgeData.key,
          attributes: edgeData.attributes,
          source: edgeData.source.key,
          target: edgeData.target.key,
          sourceAttributes: edgeData.source.attributes,
          targetAttributes: edgeData.target.attributes,
          undirected: edgeData.undirected
        };
        edgeData = edgeData.next;
        return {
          done: false,
          value
        };
      }
    };
  }
  let done = false;
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      if (done === true) return { done: true };
      done = true;
      return {
        done: false,
        value: {
          edge: edgeData.key,
          attributes: edgeData.attributes,
          source: edgeData.source.key,
          target: edgeData.target.key,
          sourceAttributes: edgeData.source.attributes,
          targetAttributes: edgeData.target.attributes,
          undirected: edgeData.undirected
        }
      };
    }
  };
}
function createEdgeArray(graph, type) {
  if (graph.size === 0) return [];
  if (type === "mixed" || type === graph.type) {
    return Array.from(graph._edges.keys());
  }
  const size = type === "undirected" ? graph.undirectedSize : graph.directedSize;
  const list = new Array(size), mask = type === "undirected";
  const iterator = graph._edges.values();
  let i2 = 0;
  let step, data;
  while (step = iterator.next(), step.done !== true) {
    data = step.value;
    if (data.undirected === mask) list[i2++] = data.key;
  }
  return list;
}
function forEachEdge(breakable, graph, type, callback) {
  if (graph.size === 0) return;
  const shouldFilter = type !== "mixed" && type !== graph.type;
  const mask = type === "undirected";
  let step, data;
  let shouldBreak = false;
  const iterator = graph._edges.values();
  while (step = iterator.next(), step.done !== true) {
    data = step.value;
    if (shouldFilter && data.undirected !== mask) continue;
    const { key, attributes, source, target } = data;
    shouldBreak = callback(
      key,
      attributes,
      source.key,
      target.key,
      source.attributes,
      target.attributes,
      data.undirected
    );
    if (breakable && shouldBreak) return key;
  }
  return;
}
function createEdgeIterator(graph, type) {
  if (graph.size === 0) return emptyIterator();
  const shouldFilter = type !== "mixed" && type !== graph.type;
  const mask = type === "undirected";
  const iterator = graph._edges.values();
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      let step, data;
      while (true) {
        step = iterator.next();
        if (step.done) return step;
        data = step.value;
        if (shouldFilter && data.undirected !== mask) continue;
        break;
      }
      const value = {
        edge: data.key,
        attributes: data.attributes,
        source: data.source.key,
        target: data.target.key,
        sourceAttributes: data.source.attributes,
        targetAttributes: data.target.attributes,
        undirected: data.undirected
      };
      return { value, done: false };
    }
  };
}
function forEachEdgeForNode(breakable, multi, type, direction, nodeData, callback) {
  const fn2 = multi ? forEachMulti : forEachSimple;
  let found;
  if (type !== "undirected") {
    if (direction !== "out") {
      found = fn2(breakable, nodeData.in, callback);
      if (breakable && found) return found;
    }
    if (direction !== "in") {
      found = fn2(
        breakable,
        nodeData.out,
        callback,
        !direction ? nodeData.key : void 0
      );
      if (breakable && found) return found;
    }
  }
  if (type !== "directed") {
    found = fn2(breakable, nodeData.undirected, callback);
    if (breakable && found) return found;
  }
  return;
}
function createEdgeArrayForNode(multi, type, direction, nodeData) {
  const edges = [];
  forEachEdgeForNode(false, multi, type, direction, nodeData, function(key) {
    edges.push(key);
  });
  return edges;
}
function createEdgeIteratorForNode(type, direction, nodeData) {
  let iterator = emptyIterator();
  if (type !== "undirected") {
    if (direction !== "out" && typeof nodeData.in !== "undefined")
      iterator = chain(iterator, createIterator(nodeData.in));
    if (direction !== "in" && typeof nodeData.out !== "undefined")
      iterator = chain(
        iterator,
        createIterator(nodeData.out, !direction ? nodeData.key : void 0)
      );
  }
  if (type !== "directed" && typeof nodeData.undirected !== "undefined") {
    iterator = chain(iterator, createIterator(nodeData.undirected));
  }
  return iterator;
}
function forEachEdgeForPath(breakable, type, multi, direction, sourceData, target, callback) {
  const fn2 = multi ? forEachForKeyMulti : forEachForKeySimple;
  let found;
  if (type !== "undirected") {
    if (typeof sourceData.in !== "undefined" && direction !== "out") {
      found = fn2(breakable, sourceData.in, target, callback);
      if (breakable && found) return found;
    }
    if (typeof sourceData.out !== "undefined" && direction !== "in" && (direction || sourceData.key !== target)) {
      found = fn2(breakable, sourceData.out, target, callback);
      if (breakable && found) return found;
    }
  }
  if (type !== "directed") {
    if (typeof sourceData.undirected !== "undefined") {
      found = fn2(breakable, sourceData.undirected, target, callback);
      if (breakable && found) return found;
    }
  }
  return;
}
function createEdgeArrayForPath(type, multi, direction, sourceData, target) {
  const edges = [];
  forEachEdgeForPath(
    false,
    type,
    multi,
    direction,
    sourceData,
    target,
    function(key) {
      edges.push(key);
    }
  );
  return edges;
}
function createEdgeIteratorForPath(type, direction, sourceData, target) {
  let iterator = emptyIterator();
  if (type !== "undirected") {
    if (typeof sourceData.in !== "undefined" && direction !== "out" && target in sourceData.in)
      iterator = chain(iterator, createIteratorForKey(sourceData.in, target));
    if (typeof sourceData.out !== "undefined" && direction !== "in" && target in sourceData.out && (direction || sourceData.key !== target))
      iterator = chain(iterator, createIteratorForKey(sourceData.out, target));
  }
  if (type !== "directed") {
    if (typeof sourceData.undirected !== "undefined" && target in sourceData.undirected)
      iterator = chain(
        iterator,
        createIteratorForKey(sourceData.undirected, target)
      );
  }
  return iterator;
}
function attachEdgeArrayCreator(Class, description) {
  const { name: name2, type, direction } = description;
  Class.prototype[name2] = function(source, target) {
    if (type !== "mixed" && this.type !== "mixed" && type !== this.type)
      return [];
    if (!arguments.length) return createEdgeArray(this, type);
    if (arguments.length === 1) {
      source = "" + source;
      const nodeData = this._nodes.get(source);
      if (typeof nodeData === "undefined")
        throw new NotFoundGraphError(
          `Graph.${name2}: could not find the "${source}" node in the graph.`
        );
      return createEdgeArrayForNode(
        this.multi,
        type === "mixed" ? this.type : type,
        direction,
        nodeData
      );
    }
    if (arguments.length === 2) {
      source = "" + source;
      target = "" + target;
      const sourceData = this._nodes.get(source);
      if (!sourceData)
        throw new NotFoundGraphError(
          `Graph.${name2}:  could not find the "${source}" source node in the graph.`
        );
      if (!this._nodes.has(target))
        throw new NotFoundGraphError(
          `Graph.${name2}:  could not find the "${target}" target node in the graph.`
        );
      return createEdgeArrayForPath(
        type,
        this.multi,
        direction,
        sourceData,
        target
      );
    }
    throw new InvalidArgumentsGraphError(
      `Graph.${name2}: too many arguments (expecting 0, 1 or 2 and got ${arguments.length}).`
    );
  };
}
function attachForEachEdge(Class, description) {
  const { name: name2, type, direction } = description;
  const forEachName = "forEach" + name2[0].toUpperCase() + name2.slice(1, -1);
  Class.prototype[forEachName] = function(source, target, callback) {
    if (type !== "mixed" && this.type !== "mixed" && type !== this.type) return;
    if (arguments.length === 1) {
      callback = source;
      return forEachEdge(false, this, type, callback);
    }
    if (arguments.length === 2) {
      source = "" + source;
      callback = target;
      const nodeData = this._nodes.get(source);
      if (typeof nodeData === "undefined")
        throw new NotFoundGraphError(
          `Graph.${forEachName}: could not find the "${source}" node in the graph.`
        );
      return forEachEdgeForNode(
        false,
        this.multi,
        type === "mixed" ? this.type : type,
        direction,
        nodeData,
        callback
      );
    }
    if (arguments.length === 3) {
      source = "" + source;
      target = "" + target;
      const sourceData = this._nodes.get(source);
      if (!sourceData)
        throw new NotFoundGraphError(
          `Graph.${forEachName}:  could not find the "${source}" source node in the graph.`
        );
      if (!this._nodes.has(target))
        throw new NotFoundGraphError(
          `Graph.${forEachName}:  could not find the "${target}" target node in the graph.`
        );
      return forEachEdgeForPath(
        false,
        type,
        this.multi,
        direction,
        sourceData,
        target,
        callback
      );
    }
    throw new InvalidArgumentsGraphError(
      `Graph.${forEachName}: too many arguments (expecting 1, 2 or 3 and got ${arguments.length}).`
    );
  };
  const mapName = "map" + name2[0].toUpperCase() + name2.slice(1);
  Class.prototype[mapName] = function() {
    const args2 = Array.prototype.slice.call(arguments);
    const callback = args2.pop();
    let result;
    if (args2.length === 0) {
      let length = 0;
      if (type !== "directed") length += this.undirectedSize;
      if (type !== "undirected") length += this.directedSize;
      result = new Array(length);
      let i2 = 0;
      args2.push((e, ea, s, t, sa, ta, u) => {
        result[i2++] = callback(e, ea, s, t, sa, ta, u);
      });
    } else {
      result = [];
      args2.push((e, ea, s, t, sa, ta, u) => {
        result.push(callback(e, ea, s, t, sa, ta, u));
      });
    }
    this[forEachName].apply(this, args2);
    return result;
  };
  const filterName = "filter" + name2[0].toUpperCase() + name2.slice(1);
  Class.prototype[filterName] = function() {
    const args2 = Array.prototype.slice.call(arguments);
    const callback = args2.pop();
    const result = [];
    args2.push((e, ea, s, t, sa, ta, u) => {
      if (callback(e, ea, s, t, sa, ta, u)) result.push(e);
    });
    this[forEachName].apply(this, args2);
    return result;
  };
  const reduceName = "reduce" + name2[0].toUpperCase() + name2.slice(1);
  Class.prototype[reduceName] = function() {
    let args2 = Array.prototype.slice.call(arguments);
    if (args2.length < 2 || args2.length > 4) {
      throw new InvalidArgumentsGraphError(
        `Graph.${reduceName}: invalid number of arguments (expecting 2, 3 or 4 and got ${args2.length}).`
      );
    }
    if (typeof args2[args2.length - 1] === "function" && typeof args2[args2.length - 2] !== "function") {
      throw new InvalidArgumentsGraphError(
        `Graph.${reduceName}: missing initial value. You must provide it because the callback takes more than one argument and we cannot infer the initial value from the first iteration, as you could with a simple array.`
      );
    }
    let callback;
    let initialValue;
    if (args2.length === 2) {
      callback = args2[0];
      initialValue = args2[1];
      args2 = [];
    } else if (args2.length === 3) {
      callback = args2[1];
      initialValue = args2[2];
      args2 = [args2[0]];
    } else if (args2.length === 4) {
      callback = args2[2];
      initialValue = args2[3];
      args2 = [args2[0], args2[1]];
    }
    let accumulator = initialValue;
    args2.push((e, ea, s, t, sa, ta, u) => {
      accumulator = callback(accumulator, e, ea, s, t, sa, ta, u);
    });
    this[forEachName].apply(this, args2);
    return accumulator;
  };
}
function attachFindEdge(Class, description) {
  const { name: name2, type, direction } = description;
  const findEdgeName = "find" + name2[0].toUpperCase() + name2.slice(1, -1);
  Class.prototype[findEdgeName] = function(source, target, callback) {
    if (type !== "mixed" && this.type !== "mixed" && type !== this.type)
      return false;
    if (arguments.length === 1) {
      callback = source;
      return forEachEdge(true, this, type, callback);
    }
    if (arguments.length === 2) {
      source = "" + source;
      callback = target;
      const nodeData = this._nodes.get(source);
      if (typeof nodeData === "undefined")
        throw new NotFoundGraphError(
          `Graph.${findEdgeName}: could not find the "${source}" node in the graph.`
        );
      return forEachEdgeForNode(
        true,
        this.multi,
        type === "mixed" ? this.type : type,
        direction,
        nodeData,
        callback
      );
    }
    if (arguments.length === 3) {
      source = "" + source;
      target = "" + target;
      const sourceData = this._nodes.get(source);
      if (!sourceData)
        throw new NotFoundGraphError(
          `Graph.${findEdgeName}:  could not find the "${source}" source node in the graph.`
        );
      if (!this._nodes.has(target))
        throw new NotFoundGraphError(
          `Graph.${findEdgeName}:  could not find the "${target}" target node in the graph.`
        );
      return forEachEdgeForPath(
        true,
        type,
        this.multi,
        direction,
        sourceData,
        target,
        callback
      );
    }
    throw new InvalidArgumentsGraphError(
      `Graph.${findEdgeName}: too many arguments (expecting 1, 2 or 3 and got ${arguments.length}).`
    );
  };
  const someName = "some" + name2[0].toUpperCase() + name2.slice(1, -1);
  Class.prototype[someName] = function() {
    const args2 = Array.prototype.slice.call(arguments);
    const callback = args2.pop();
    args2.push((e, ea, s, t, sa, ta, u) => {
      return callback(e, ea, s, t, sa, ta, u);
    });
    const found = this[findEdgeName].apply(this, args2);
    if (found) return true;
    return false;
  };
  const everyName = "every" + name2[0].toUpperCase() + name2.slice(1, -1);
  Class.prototype[everyName] = function() {
    const args2 = Array.prototype.slice.call(arguments);
    const callback = args2.pop();
    args2.push((e, ea, s, t, sa, ta, u) => {
      return !callback(e, ea, s, t, sa, ta, u);
    });
    const found = this[findEdgeName].apply(this, args2);
    if (found) return false;
    return true;
  };
}
function attachEdgeIteratorCreator(Class, description) {
  const { name: originalName, type, direction } = description;
  const name2 = originalName.slice(0, -1) + "Entries";
  Class.prototype[name2] = function(source, target) {
    if (type !== "mixed" && this.type !== "mixed" && type !== this.type)
      return emptyIterator();
    if (!arguments.length) return createEdgeIterator(this, type);
    if (arguments.length === 1) {
      source = "" + source;
      const sourceData = this._nodes.get(source);
      if (!sourceData)
        throw new NotFoundGraphError(
          `Graph.${name2}: could not find the "${source}" node in the graph.`
        );
      return createEdgeIteratorForNode(type, direction, sourceData);
    }
    if (arguments.length === 2) {
      source = "" + source;
      target = "" + target;
      const sourceData = this._nodes.get(source);
      if (!sourceData)
        throw new NotFoundGraphError(
          `Graph.${name2}:  could not find the "${source}" source node in the graph.`
        );
      if (!this._nodes.has(target))
        throw new NotFoundGraphError(
          `Graph.${name2}:  could not find the "${target}" target node in the graph.`
        );
      return createEdgeIteratorForPath(type, direction, sourceData, target);
    }
    throw new InvalidArgumentsGraphError(
      `Graph.${name2}: too many arguments (expecting 0, 1 or 2 and got ${arguments.length}).`
    );
  };
}
function attachEdgeIterationMethods(Graph3) {
  EDGES_ITERATION.forEach((description) => {
    attachEdgeArrayCreator(Graph3, description);
    attachForEachEdge(Graph3, description);
    attachFindEdge(Graph3, description);
    attachEdgeIteratorCreator(Graph3, description);
  });
}
var NEIGHBORS_ITERATION = [
  {
    name: "neighbors",
    type: "mixed"
  },
  {
    name: "inNeighbors",
    type: "directed",
    direction: "in"
  },
  {
    name: "outNeighbors",
    type: "directed",
    direction: "out"
  },
  {
    name: "inboundNeighbors",
    type: "mixed",
    direction: "in"
  },
  {
    name: "outboundNeighbors",
    type: "mixed",
    direction: "out"
  },
  {
    name: "directedNeighbors",
    type: "directed"
  },
  {
    name: "undirectedNeighbors",
    type: "undirected"
  }
];
function CompositeSetWrapper() {
  this.A = null;
  this.B = null;
}
CompositeSetWrapper.prototype.wrap = function(set) {
  if (this.A === null) this.A = set;
  else if (this.B === null) this.B = set;
};
CompositeSetWrapper.prototype.has = function(key) {
  if (this.A !== null && key in this.A) return true;
  if (this.B !== null && key in this.B) return true;
  return false;
};
function forEachInObjectOnce(breakable, visited, nodeData, object, callback) {
  for (const k in object) {
    const edgeData = object[k];
    const sourceData = edgeData.source;
    const targetData = edgeData.target;
    const neighborData = sourceData === nodeData ? targetData : sourceData;
    if (visited && visited.has(neighborData.key)) continue;
    const shouldBreak = callback(neighborData.key, neighborData.attributes);
    if (breakable && shouldBreak) return neighborData.key;
  }
  return;
}
function forEachNeighbor(breakable, type, direction, nodeData, callback) {
  if (type !== "mixed") {
    if (type === "undirected")
      return forEachInObjectOnce(
        breakable,
        null,
        nodeData,
        nodeData.undirected,
        callback
      );
    if (typeof direction === "string")
      return forEachInObjectOnce(
        breakable,
        null,
        nodeData,
        nodeData[direction],
        callback
      );
  }
  const visited = new CompositeSetWrapper();
  let found;
  if (type !== "undirected") {
    if (direction !== "out") {
      found = forEachInObjectOnce(
        breakable,
        null,
        nodeData,
        nodeData.in,
        callback
      );
      if (breakable && found) return found;
      visited.wrap(nodeData.in);
    }
    if (direction !== "in") {
      found = forEachInObjectOnce(
        breakable,
        visited,
        nodeData,
        nodeData.out,
        callback
      );
      if (breakable && found) return found;
      visited.wrap(nodeData.out);
    }
  }
  if (type !== "directed") {
    found = forEachInObjectOnce(
      breakable,
      visited,
      nodeData,
      nodeData.undirected,
      callback
    );
    if (breakable && found) return found;
  }
  return;
}
function createNeighborArrayForNode(type, direction, nodeData) {
  if (type !== "mixed") {
    if (type === "undirected") return Object.keys(nodeData.undirected);
    if (typeof direction === "string") return Object.keys(nodeData[direction]);
  }
  const neighbors = [];
  forEachNeighbor(false, type, direction, nodeData, function(key) {
    neighbors.push(key);
  });
  return neighbors;
}
function createDedupedObjectIterator(visited, nodeData, object) {
  const keys = Object.keys(object);
  const l = keys.length;
  let i2 = 0;
  return {
    [Symbol.iterator]() {
      return this;
    },
    next() {
      let neighborData = null;
      do {
        if (i2 >= l) {
          if (visited) visited.wrap(object);
          return { done: true };
        }
        const edgeData = object[keys[i2++]];
        const sourceData = edgeData.source;
        const targetData = edgeData.target;
        neighborData = sourceData === nodeData ? targetData : sourceData;
        if (visited && visited.has(neighborData.key)) {
          neighborData = null;
          continue;
        }
      } while (neighborData === null);
      return {
        done: false,
        value: { neighbor: neighborData.key, attributes: neighborData.attributes }
      };
    }
  };
}
function createNeighborIterator(type, direction, nodeData) {
  if (type !== "mixed") {
    if (type === "undirected")
      return createDedupedObjectIterator(null, nodeData, nodeData.undirected);
    if (typeof direction === "string")
      return createDedupedObjectIterator(null, nodeData, nodeData[direction]);
  }
  let iterator = emptyIterator();
  const visited = new CompositeSetWrapper();
  if (type !== "undirected") {
    if (direction !== "out") {
      iterator = chain(
        iterator,
        createDedupedObjectIterator(visited, nodeData, nodeData.in)
      );
    }
    if (direction !== "in") {
      iterator = chain(
        iterator,
        createDedupedObjectIterator(visited, nodeData, nodeData.out)
      );
    }
  }
  if (type !== "directed") {
    iterator = chain(
      iterator,
      createDedupedObjectIterator(visited, nodeData, nodeData.undirected)
    );
  }
  return iterator;
}
function attachNeighborArrayCreator(Class, description) {
  const { name: name2, type, direction } = description;
  Class.prototype[name2] = function(node) {
    if (type !== "mixed" && this.type !== "mixed" && type !== this.type)
      return [];
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (typeof nodeData === "undefined")
      throw new NotFoundGraphError(
        `Graph.${name2}: could not find the "${node}" node in the graph.`
      );
    return createNeighborArrayForNode(
      type === "mixed" ? this.type : type,
      direction,
      nodeData
    );
  };
}
function attachForEachNeighbor(Class, description) {
  const { name: name2, type, direction } = description;
  const forEachName = "forEach" + name2[0].toUpperCase() + name2.slice(1, -1);
  Class.prototype[forEachName] = function(node, callback) {
    if (type !== "mixed" && this.type !== "mixed" && type !== this.type) return;
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (typeof nodeData === "undefined")
      throw new NotFoundGraphError(
        `Graph.${forEachName}: could not find the "${node}" node in the graph.`
      );
    forEachNeighbor(
      false,
      type === "mixed" ? this.type : type,
      direction,
      nodeData,
      callback
    );
  };
  const mapName = "map" + name2[0].toUpperCase() + name2.slice(1);
  Class.prototype[mapName] = function(node, callback) {
    const result = [];
    this[forEachName](node, (n, a) => {
      result.push(callback(n, a));
    });
    return result;
  };
  const filterName = "filter" + name2[0].toUpperCase() + name2.slice(1);
  Class.prototype[filterName] = function(node, callback) {
    const result = [];
    this[forEachName](node, (n, a) => {
      if (callback(n, a)) result.push(n);
    });
    return result;
  };
  const reduceName = "reduce" + name2[0].toUpperCase() + name2.slice(1);
  Class.prototype[reduceName] = function(node, callback, initialValue) {
    if (arguments.length < 3)
      throw new InvalidArgumentsGraphError(
        `Graph.${reduceName}: missing initial value. You must provide it because the callback takes more than one argument and we cannot infer the initial value from the first iteration, as you could with a simple array.`
      );
    let accumulator = initialValue;
    this[forEachName](node, (n, a) => {
      accumulator = callback(accumulator, n, a);
    });
    return accumulator;
  };
}
function attachFindNeighbor(Class, description) {
  const { name: name2, type, direction } = description;
  const capitalizedSingular = name2[0].toUpperCase() + name2.slice(1, -1);
  const findName = "find" + capitalizedSingular;
  Class.prototype[findName] = function(node, callback) {
    if (type !== "mixed" && this.type !== "mixed" && type !== this.type) return;
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (typeof nodeData === "undefined")
      throw new NotFoundGraphError(
        `Graph.${findName}: could not find the "${node}" node in the graph.`
      );
    return forEachNeighbor(
      true,
      type === "mixed" ? this.type : type,
      direction,
      nodeData,
      callback
    );
  };
  const someName = "some" + capitalizedSingular;
  Class.prototype[someName] = function(node, callback) {
    const found = this[findName](node, callback);
    if (found) return true;
    return false;
  };
  const everyName = "every" + capitalizedSingular;
  Class.prototype[everyName] = function(node, callback) {
    const found = this[findName](node, (n, a) => {
      return !callback(n, a);
    });
    if (found) return false;
    return true;
  };
}
function attachNeighborIteratorCreator(Class, description) {
  const { name: name2, type, direction } = description;
  const iteratorName = name2.slice(0, -1) + "Entries";
  Class.prototype[iteratorName] = function(node) {
    if (type !== "mixed" && this.type !== "mixed" && type !== this.type)
      return emptyIterator();
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (typeof nodeData === "undefined")
      throw new NotFoundGraphError(
        `Graph.${iteratorName}: could not find the "${node}" node in the graph.`
      );
    return createNeighborIterator(
      type === "mixed" ? this.type : type,
      direction,
      nodeData
    );
  };
}
function attachNeighborIterationMethods(Graph3) {
  NEIGHBORS_ITERATION.forEach((description) => {
    attachNeighborArrayCreator(Graph3, description);
    attachForEachNeighbor(Graph3, description);
    attachFindNeighbor(Graph3, description);
    attachNeighborIteratorCreator(Graph3, description);
  });
}
function forEachAdjacency(breakable, assymetric, disconnectedNodes, graph, callback) {
  const iterator = graph._nodes.values();
  const type = graph.type;
  let step, sourceData, neighbor, adj, edgeData, targetData, shouldBreak;
  while (step = iterator.next(), step.done !== true) {
    let hasEdges = false;
    sourceData = step.value;
    if (type !== "undirected") {
      adj = sourceData.out;
      for (neighbor in adj) {
        edgeData = adj[neighbor];
        do {
          targetData = edgeData.target;
          hasEdges = true;
          shouldBreak = callback(
            sourceData.key,
            targetData.key,
            sourceData.attributes,
            targetData.attributes,
            edgeData.key,
            edgeData.attributes,
            edgeData.undirected
          );
          if (breakable && shouldBreak) return edgeData;
          edgeData = edgeData.next;
        } while (edgeData);
      }
    }
    if (type !== "directed") {
      adj = sourceData.undirected;
      for (neighbor in adj) {
        if (assymetric && sourceData.key > neighbor) continue;
        edgeData = adj[neighbor];
        do {
          targetData = edgeData.target;
          if (targetData.key !== neighbor) targetData = edgeData.source;
          hasEdges = true;
          shouldBreak = callback(
            sourceData.key,
            targetData.key,
            sourceData.attributes,
            targetData.attributes,
            edgeData.key,
            edgeData.attributes,
            edgeData.undirected
          );
          if (breakable && shouldBreak) return edgeData;
          edgeData = edgeData.next;
        } while (edgeData);
      }
    }
    if (disconnectedNodes && !hasEdges) {
      shouldBreak = callback(
        sourceData.key,
        null,
        sourceData.attributes,
        null,
        null,
        null,
        null
      );
      if (breakable && shouldBreak) return null;
    }
  }
  return;
}
function serializeNode(key, data) {
  const serialized = { key };
  if (!isEmpty(data.attributes))
    serialized.attributes = assign({}, data.attributes);
  return serialized;
}
function serializeEdge(type, key, data) {
  const serialized = {
    key,
    source: data.source.key,
    target: data.target.key
  };
  if (!isEmpty(data.attributes))
    serialized.attributes = assign({}, data.attributes);
  if (type === "mixed" && data.undirected) serialized.undirected = true;
  return serialized;
}
function validateSerializedNode(value) {
  if (!isPlainObject(value))
    throw new InvalidArgumentsGraphError(
      'Graph.import: invalid serialized node. A serialized node should be a plain object with at least a "key" property.'
    );
  if (!("key" in value))
    throw new InvalidArgumentsGraphError(
      "Graph.import: serialized node is missing its key."
    );
  if ("attributes" in value && (!isPlainObject(value.attributes) || value.attributes === null))
    throw new InvalidArgumentsGraphError(
      "Graph.import: invalid attributes. Attributes should be a plain object, null or omitted."
    );
}
function validateSerializedEdge(value) {
  if (!isPlainObject(value))
    throw new InvalidArgumentsGraphError(
      'Graph.import: invalid serialized edge. A serialized edge should be a plain object with at least a "source" & "target" property.'
    );
  if (!("source" in value))
    throw new InvalidArgumentsGraphError(
      "Graph.import: serialized edge is missing its source."
    );
  if (!("target" in value))
    throw new InvalidArgumentsGraphError(
      "Graph.import: serialized edge is missing its target."
    );
  if ("attributes" in value && (!isPlainObject(value.attributes) || value.attributes === null))
    throw new InvalidArgumentsGraphError(
      "Graph.import: invalid attributes. Attributes should be a plain object, null or omitted."
    );
  if ("undirected" in value && typeof value.undirected !== "boolean")
    throw new InvalidArgumentsGraphError(
      "Graph.import: invalid undirectedness information. Undirected should be boolean or omitted."
    );
}
var INSTANCE_ID = incrementalIdStartingFromRandomByte();
var TYPES = /* @__PURE__ */ new Set(["directed", "undirected", "mixed"]);
var EMITTER_PROPS = /* @__PURE__ */ new Set([
  "domain",
  "_events",
  "_eventsCount",
  "_maxListeners"
]);
var EDGE_ADD_METHODS = [
  {
    name: (verb) => `${verb}Edge`,
    generateKey: true
  },
  {
    name: (verb) => `${verb}DirectedEdge`,
    generateKey: true,
    type: "directed"
  },
  {
    name: (verb) => `${verb}UndirectedEdge`,
    generateKey: true,
    type: "undirected"
  },
  {
    name: (verb) => `${verb}EdgeWithKey`
  },
  {
    name: (verb) => `${verb}DirectedEdgeWithKey`,
    type: "directed"
  },
  {
    name: (verb) => `${verb}UndirectedEdgeWithKey`,
    type: "undirected"
  }
];
var DEFAULTS = {
  allowSelfLoops: true,
  multi: false,
  type: "mixed"
};
function addNode(graph, node, attributes) {
  if (attributes && !isPlainObject(attributes))
    throw new InvalidArgumentsGraphError(
      `Graph.addNode: invalid attributes. Expecting an object but got "${attributes}"`
    );
  node = "" + node;
  attributes = attributes || {};
  if (graph._nodes.has(node))
    throw new UsageGraphError(
      `Graph.addNode: the "${node}" node already exist in the graph.`
    );
  const data = new graph.NodeDataClass(node, attributes);
  graph._nodes.set(node, data);
  graph.emit("nodeAdded", {
    key: node,
    attributes
  });
  return data;
}
function unsafeAddNode(graph, node, attributes) {
  const data = new graph.NodeDataClass(node, attributes);
  graph._nodes.set(node, data);
  graph.emit("nodeAdded", {
    key: node,
    attributes
  });
  return data;
}
function addEdge(graph, name2, mustGenerateKey, undirected, edge2, source, target, attributes) {
  if (!undirected && graph.type === "undirected")
    throw new UsageGraphError(
      `Graph.${name2}: you cannot add a directed edge to an undirected graph. Use the #.addEdge or #.addUndirectedEdge instead.`
    );
  if (undirected && graph.type === "directed")
    throw new UsageGraphError(
      `Graph.${name2}: you cannot add an undirected edge to a directed graph. Use the #.addEdge or #.addDirectedEdge instead.`
    );
  if (attributes && !isPlainObject(attributes))
    throw new InvalidArgumentsGraphError(
      `Graph.${name2}: invalid attributes. Expecting an object but got "${attributes}"`
    );
  source = "" + source;
  target = "" + target;
  attributes = attributes || {};
  if (!graph.allowSelfLoops && source === target)
    throw new UsageGraphError(
      `Graph.${name2}: source & target are the same ("${source}"), thus creating a loop explicitly forbidden by this graph 'allowSelfLoops' option set to false.`
    );
  const sourceData = graph._nodes.get(source), targetData = graph._nodes.get(target);
  if (!sourceData)
    throw new NotFoundGraphError(
      `Graph.${name2}: source node "${source}" not found.`
    );
  if (!targetData)
    throw new NotFoundGraphError(
      `Graph.${name2}: target node "${target}" not found.`
    );
  const eventData = {
    key: null,
    undirected,
    source,
    target,
    attributes
  };
  if (mustGenerateKey) {
    edge2 = graph._edgeKeyGenerator();
  } else {
    edge2 = "" + edge2;
    if (graph._edges.has(edge2))
      throw new UsageGraphError(
        `Graph.${name2}: the "${edge2}" edge already exists in the graph.`
      );
  }
  if (!graph.multi && (undirected ? typeof sourceData.undirected[target] !== "undefined" : typeof sourceData.out[target] !== "undefined")) {
    throw new UsageGraphError(
      `Graph.${name2}: an edge linking "${source}" to "${target}" already exists. If you really want to add multiple edges linking those nodes, you should create a multi graph by using the 'multi' option.`
    );
  }
  const edgeData = new EdgeData(
    undirected,
    edge2,
    sourceData,
    targetData,
    attributes
  );
  graph._edges.set(edge2, edgeData);
  const isSelfLoop = source === target;
  if (undirected) {
    sourceData.undirectedDegree++;
    targetData.undirectedDegree++;
    if (isSelfLoop) {
      sourceData.undirectedLoops++;
      graph._undirectedSelfLoopCount++;
    }
  } else {
    sourceData.outDegree++;
    targetData.inDegree++;
    if (isSelfLoop) {
      sourceData.directedLoops++;
      graph._directedSelfLoopCount++;
    }
  }
  if (graph.multi) edgeData.attachMulti();
  else edgeData.attach();
  if (undirected) graph._undirectedSize++;
  else graph._directedSize++;
  eventData.key = edge2;
  graph.emit("edgeAdded", eventData);
  return edge2;
}
function mergeEdge(graph, name2, mustGenerateKey, undirected, edge2, source, target, attributes, asUpdater) {
  if (!undirected && graph.type === "undirected")
    throw new UsageGraphError(
      `Graph.${name2}: you cannot merge/update a directed edge to an undirected graph. Use the #.mergeEdge/#.updateEdge or #.addUndirectedEdge instead.`
    );
  if (undirected && graph.type === "directed")
    throw new UsageGraphError(
      `Graph.${name2}: you cannot merge/update an undirected edge to a directed graph. Use the #.mergeEdge/#.updateEdge or #.addDirectedEdge instead.`
    );
  if (attributes) {
    if (asUpdater) {
      if (typeof attributes !== "function")
        throw new InvalidArgumentsGraphError(
          `Graph.${name2}: invalid updater function. Expecting a function but got "${attributes}"`
        );
    } else {
      if (!isPlainObject(attributes))
        throw new InvalidArgumentsGraphError(
          `Graph.${name2}: invalid attributes. Expecting an object but got "${attributes}"`
        );
    }
  }
  source = "" + source;
  target = "" + target;
  let updater;
  if (asUpdater) {
    updater = attributes;
    attributes = void 0;
  }
  if (!graph.allowSelfLoops && source === target)
    throw new UsageGraphError(
      `Graph.${name2}: source & target are the same ("${source}"), thus creating a loop explicitly forbidden by this graph 'allowSelfLoops' option set to false.`
    );
  let sourceData = graph._nodes.get(source);
  let targetData = graph._nodes.get(target);
  let edgeData;
  let alreadyExistingEdgeData;
  if (!mustGenerateKey) {
    edgeData = graph._edges.get(edge2);
    if (edgeData) {
      if (edgeData.source.key !== source || edgeData.target.key !== target) {
        if (!undirected || edgeData.source.key !== target || edgeData.target.key !== source) {
          throw new UsageGraphError(
            `Graph.${name2}: inconsistency detected when attempting to merge the "${edge2}" edge with "${source}" source & "${target}" target vs. ("${edgeData.source.key}", "${edgeData.target.key}").`
          );
        }
      }
      alreadyExistingEdgeData = edgeData;
    }
  }
  if (!alreadyExistingEdgeData && !graph.multi && sourceData) {
    alreadyExistingEdgeData = undirected ? sourceData.undirected[target] : sourceData.out[target];
  }
  if (alreadyExistingEdgeData) {
    const info2 = [alreadyExistingEdgeData.key, false, false, false];
    if (asUpdater ? !updater : !attributes) return info2;
    if (asUpdater) {
      const oldAttributes = alreadyExistingEdgeData.attributes;
      alreadyExistingEdgeData.attributes = updater(oldAttributes);
      graph.emit("edgeAttributesUpdated", {
        type: "replace",
        key: alreadyExistingEdgeData.key,
        attributes: alreadyExistingEdgeData.attributes
      });
    } else {
      assign(alreadyExistingEdgeData.attributes, attributes);
      graph.emit("edgeAttributesUpdated", {
        type: "merge",
        key: alreadyExistingEdgeData.key,
        attributes: alreadyExistingEdgeData.attributes,
        data: attributes
      });
    }
    return info2;
  }
  attributes = attributes || {};
  if (asUpdater && updater) attributes = updater(attributes);
  const eventData = {
    key: null,
    undirected,
    source,
    target,
    attributes
  };
  if (mustGenerateKey) {
    edge2 = graph._edgeKeyGenerator();
  } else {
    edge2 = "" + edge2;
    if (graph._edges.has(edge2))
      throw new UsageGraphError(
        `Graph.${name2}: the "${edge2}" edge already exists in the graph.`
      );
  }
  let sourceWasAdded = false;
  let targetWasAdded = false;
  if (!sourceData) {
    sourceData = unsafeAddNode(graph, source, {});
    sourceWasAdded = true;
    if (source === target) {
      targetData = sourceData;
      targetWasAdded = true;
    }
  }
  if (!targetData) {
    targetData = unsafeAddNode(graph, target, {});
    targetWasAdded = true;
  }
  edgeData = new EdgeData(undirected, edge2, sourceData, targetData, attributes);
  graph._edges.set(edge2, edgeData);
  const isSelfLoop = source === target;
  if (undirected) {
    sourceData.undirectedDegree++;
    targetData.undirectedDegree++;
    if (isSelfLoop) {
      sourceData.undirectedLoops++;
      graph._undirectedSelfLoopCount++;
    }
  } else {
    sourceData.outDegree++;
    targetData.inDegree++;
    if (isSelfLoop) {
      sourceData.directedLoops++;
      graph._directedSelfLoopCount++;
    }
  }
  if (graph.multi) edgeData.attachMulti();
  else edgeData.attach();
  if (undirected) graph._undirectedSize++;
  else graph._directedSize++;
  eventData.key = edge2;
  graph.emit("edgeAdded", eventData);
  return [edge2, true, sourceWasAdded, targetWasAdded];
}
function dropEdgeFromData(graph, edgeData) {
  graph._edges.delete(edgeData.key);
  const { source: sourceData, target: targetData, attributes } = edgeData;
  const undirected = edgeData.undirected;
  const isSelfLoop = sourceData === targetData;
  if (undirected) {
    sourceData.undirectedDegree--;
    targetData.undirectedDegree--;
    if (isSelfLoop) {
      sourceData.undirectedLoops--;
      graph._undirectedSelfLoopCount--;
    }
  } else {
    sourceData.outDegree--;
    targetData.inDegree--;
    if (isSelfLoop) {
      sourceData.directedLoops--;
      graph._directedSelfLoopCount--;
    }
  }
  if (graph.multi) edgeData.detachMulti();
  else edgeData.detach();
  if (undirected) graph._undirectedSize--;
  else graph._directedSize--;
  graph.emit("edgeDropped", {
    key: edgeData.key,
    attributes,
    source: sourceData.key,
    target: targetData.key,
    undirected
  });
}
var Graph = class _Graph extends EventEmitter {
  constructor(options) {
    super();
    options = assign({}, DEFAULTS, options);
    if (typeof options.multi !== "boolean")
      throw new InvalidArgumentsGraphError(
        `Graph.constructor: invalid 'multi' option. Expecting a boolean but got "${options.multi}".`
      );
    if (!TYPES.has(options.type))
      throw new InvalidArgumentsGraphError(
        `Graph.constructor: invalid 'type' option. Should be one of "mixed", "directed" or "undirected" but got "${options.type}".`
      );
    if (typeof options.allowSelfLoops !== "boolean")
      throw new InvalidArgumentsGraphError(
        `Graph.constructor: invalid 'allowSelfLoops' option. Expecting a boolean but got "${options.allowSelfLoops}".`
      );
    const NodeDataClass = options.type === "mixed" ? MixedNodeData : options.type === "directed" ? DirectedNodeData : UndirectedNodeData;
    privateProperty(this, "NodeDataClass", NodeDataClass);
    const instancePrefix = "geid_" + INSTANCE_ID() + "_";
    let edgeId = 0;
    const edgeKeyGenerator = () => {
      let availableEdgeKey;
      do {
        availableEdgeKey = instancePrefix + edgeId++;
      } while (this._edges.has(availableEdgeKey));
      return availableEdgeKey;
    };
    privateProperty(this, "_attributes", {});
    privateProperty(this, "_nodes", /* @__PURE__ */ new Map());
    privateProperty(this, "_edges", /* @__PURE__ */ new Map());
    privateProperty(this, "_directedSize", 0);
    privateProperty(this, "_undirectedSize", 0);
    privateProperty(this, "_directedSelfLoopCount", 0);
    privateProperty(this, "_undirectedSelfLoopCount", 0);
    privateProperty(this, "_edgeKeyGenerator", edgeKeyGenerator);
    privateProperty(this, "_options", options);
    EMITTER_PROPS.forEach((prop) => privateProperty(this, prop, this[prop]));
    readOnlyProperty(this, "order", () => this._nodes.size);
    readOnlyProperty(this, "size", () => this._edges.size);
    readOnlyProperty(this, "directedSize", () => this._directedSize);
    readOnlyProperty(this, "undirectedSize", () => this._undirectedSize);
    readOnlyProperty(
      this,
      "selfLoopCount",
      () => this._directedSelfLoopCount + this._undirectedSelfLoopCount
    );
    readOnlyProperty(
      this,
      "directedSelfLoopCount",
      () => this._directedSelfLoopCount
    );
    readOnlyProperty(
      this,
      "undirectedSelfLoopCount",
      () => this._undirectedSelfLoopCount
    );
    readOnlyProperty(this, "multi", this._options.multi);
    readOnlyProperty(this, "type", this._options.type);
    readOnlyProperty(this, "allowSelfLoops", this._options.allowSelfLoops);
    readOnlyProperty(this, "implementation", () => "graphology");
  }
  _resetInstanceCounters() {
    this._directedSize = 0;
    this._undirectedSize = 0;
    this._directedSelfLoopCount = 0;
    this._undirectedSelfLoopCount = 0;
  }
  /**---------------------------------------------------------------------------
   * Read
   **---------------------------------------------------------------------------
   */
  /**
   * Method returning whether the given node is found in the graph.
   *
   * @param  {any}     node - The node.
   * @return {boolean}
   */
  hasNode(node) {
    return this._nodes.has("" + node);
  }
  /**
   * Method returning whether the given directed edge is found in the graph.
   *
   * Arity 1:
   * @param  {any}     edge - The edge's key.
   *
   * Arity 2:
   * @param  {any}     source - The edge's source.
   * @param  {any}     target - The edge's target.
   *
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the arguments are invalid.
   */
  hasDirectedEdge(source, target) {
    if (this.type === "undirected") return false;
    if (arguments.length === 1) {
      const edge2 = "" + source;
      const edgeData = this._edges.get(edge2);
      return !!edgeData && !edgeData.undirected;
    } else if (arguments.length === 2) {
      source = "" + source;
      target = "" + target;
      const nodeData = this._nodes.get(source);
      if (!nodeData) return false;
      return nodeData.out.hasOwnProperty(target);
    }
    throw new InvalidArgumentsGraphError(
      `Graph.hasDirectedEdge: invalid arity (${arguments.length}, instead of 1 or 2). You can either ask for an edge id or for the existence of an edge between a source & a target.`
    );
  }
  /**
   * Method returning whether the given undirected edge is found in the graph.
   *
   * Arity 1:
   * @param  {any}     edge - The edge's key.
   *
   * Arity 2:
   * @param  {any}     source - The edge's source.
   * @param  {any}     target - The edge's target.
   *
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the arguments are invalid.
   */
  hasUndirectedEdge(source, target) {
    if (this.type === "directed") return false;
    if (arguments.length === 1) {
      const edge2 = "" + source;
      const edgeData = this._edges.get(edge2);
      return !!edgeData && edgeData.undirected;
    } else if (arguments.length === 2) {
      source = "" + source;
      target = "" + target;
      const nodeData = this._nodes.get(source);
      if (!nodeData) return false;
      return nodeData.undirected.hasOwnProperty(target);
    }
    throw new InvalidArgumentsGraphError(
      `Graph.hasDirectedEdge: invalid arity (${arguments.length}, instead of 1 or 2). You can either ask for an edge id or for the existence of an edge between a source & a target.`
    );
  }
  /**
   * Method returning whether the given edge is found in the graph.
   *
   * Arity 1:
   * @param  {any}     edge - The edge's key.
   *
   * Arity 2:
   * @param  {any}     source - The edge's source.
   * @param  {any}     target - The edge's target.
   *
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the arguments are invalid.
   */
  hasEdge(source, target) {
    if (arguments.length === 1) {
      const edge2 = "" + source;
      return this._edges.has(edge2);
    } else if (arguments.length === 2) {
      source = "" + source;
      target = "" + target;
      const nodeData = this._nodes.get(source);
      if (!nodeData) return false;
      return typeof nodeData.out !== "undefined" && nodeData.out.hasOwnProperty(target) || typeof nodeData.undirected !== "undefined" && nodeData.undirected.hasOwnProperty(target);
    }
    throw new InvalidArgumentsGraphError(
      `Graph.hasEdge: invalid arity (${arguments.length}, instead of 1 or 2). You can either ask for an edge id or for the existence of an edge between a source & a target.`
    );
  }
  /**
   * Method returning the edge matching source & target in a directed fashion.
   *
   * @param  {any} source - The edge's source.
   * @param  {any} target - The edge's target.
   *
   * @return {any|undefined}
   *
   * @throws {Error} - Will throw if the graph is multi.
   * @throws {Error} - Will throw if source or target doesn't exist.
   */
  directedEdge(source, target) {
    if (this.type === "undirected") return;
    source = "" + source;
    target = "" + target;
    if (this.multi)
      throw new UsageGraphError(
        "Graph.directedEdge: this method is irrelevant with multigraphs since there might be multiple edges between source & target. See #.directedEdges instead."
      );
    const sourceData = this._nodes.get(source);
    if (!sourceData)
      throw new NotFoundGraphError(
        `Graph.directedEdge: could not find the "${source}" source node in the graph.`
      );
    if (!this._nodes.has(target))
      throw new NotFoundGraphError(
        `Graph.directedEdge: could not find the "${target}" target node in the graph.`
      );
    const edgeData = sourceData.out && sourceData.out[target] || void 0;
    if (edgeData) return edgeData.key;
  }
  /**
   * Method returning the edge matching source & target in a undirected fashion.
   *
   * @param  {any} source - The edge's source.
   * @param  {any} target - The edge's target.
   *
   * @return {any|undefined}
   *
   * @throws {Error} - Will throw if the graph is multi.
   * @throws {Error} - Will throw if source or target doesn't exist.
   */
  undirectedEdge(source, target) {
    if (this.type === "directed") return;
    source = "" + source;
    target = "" + target;
    if (this.multi)
      throw new UsageGraphError(
        "Graph.undirectedEdge: this method is irrelevant with multigraphs since there might be multiple edges between source & target. See #.undirectedEdges instead."
      );
    const sourceData = this._nodes.get(source);
    if (!sourceData)
      throw new NotFoundGraphError(
        `Graph.undirectedEdge: could not find the "${source}" source node in the graph.`
      );
    if (!this._nodes.has(target))
      throw new NotFoundGraphError(
        `Graph.undirectedEdge: could not find the "${target}" target node in the graph.`
      );
    const edgeData = sourceData.undirected && sourceData.undirected[target] || void 0;
    if (edgeData) return edgeData.key;
  }
  /**
   * Method returning the edge matching source & target in a mixed fashion.
   *
   * @param  {any} source - The edge's source.
   * @param  {any} target - The edge's target.
   *
   * @return {any|undefined}
   *
   * @throws {Error} - Will throw if the graph is multi.
   * @throws {Error} - Will throw if source or target doesn't exist.
   */
  edge(source, target) {
    if (this.multi)
      throw new UsageGraphError(
        "Graph.edge: this method is irrelevant with multigraphs since there might be multiple edges between source & target. See #.edges instead."
      );
    source = "" + source;
    target = "" + target;
    const sourceData = this._nodes.get(source);
    if (!sourceData)
      throw new NotFoundGraphError(
        `Graph.edge: could not find the "${source}" source node in the graph.`
      );
    if (!this._nodes.has(target))
      throw new NotFoundGraphError(
        `Graph.edge: could not find the "${target}" target node in the graph.`
      );
    const edgeData = sourceData.out && sourceData.out[target] || sourceData.undirected && sourceData.undirected[target] || void 0;
    if (edgeData) return edgeData.key;
  }
  /**
   * Method returning whether two nodes are directed neighbors.
   *
   * @param  {any}     node     - The node's key.
   * @param  {any}     neighbor - The neighbor's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  areDirectedNeighbors(node, neighbor) {
    node = "" + node;
    neighbor = "" + neighbor;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.areDirectedNeighbors: could not find the "${node}" node in the graph.`
      );
    if (this.type === "undirected") return false;
    return neighbor in nodeData.in || neighbor in nodeData.out;
  }
  /**
   * Method returning whether two nodes are out neighbors.
   *
   * @param  {any}     node     - The node's key.
   * @param  {any}     neighbor - The neighbor's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  areOutNeighbors(node, neighbor) {
    node = "" + node;
    neighbor = "" + neighbor;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.areOutNeighbors: could not find the "${node}" node in the graph.`
      );
    if (this.type === "undirected") return false;
    return neighbor in nodeData.out;
  }
  /**
   * Method returning whether two nodes are in neighbors.
   *
   * @param  {any}     node     - The node's key.
   * @param  {any}     neighbor - The neighbor's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  areInNeighbors(node, neighbor) {
    node = "" + node;
    neighbor = "" + neighbor;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.areInNeighbors: could not find the "${node}" node in the graph.`
      );
    if (this.type === "undirected") return false;
    return neighbor in nodeData.in;
  }
  /**
   * Method returning whether two nodes are undirected neighbors.
   *
   * @param  {any}     node     - The node's key.
   * @param  {any}     neighbor - The neighbor's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  areUndirectedNeighbors(node, neighbor) {
    node = "" + node;
    neighbor = "" + neighbor;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.areUndirectedNeighbors: could not find the "${node}" node in the graph.`
      );
    if (this.type === "directed") return false;
    return neighbor in nodeData.undirected;
  }
  /**
   * Method returning whether two nodes are neighbors.
   *
   * @param  {any}     node     - The node's key.
   * @param  {any}     neighbor - The neighbor's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  areNeighbors(node, neighbor) {
    node = "" + node;
    neighbor = "" + neighbor;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.areNeighbors: could not find the "${node}" node in the graph.`
      );
    if (this.type !== "undirected") {
      if (neighbor in nodeData.in || neighbor in nodeData.out) return true;
    }
    if (this.type !== "directed") {
      if (neighbor in nodeData.undirected) return true;
    }
    return false;
  }
  /**
   * Method returning whether two nodes are inbound neighbors.
   *
   * @param  {any}     node     - The node's key.
   * @param  {any}     neighbor - The neighbor's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  areInboundNeighbors(node, neighbor) {
    node = "" + node;
    neighbor = "" + neighbor;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.areInboundNeighbors: could not find the "${node}" node in the graph.`
      );
    if (this.type !== "undirected") {
      if (neighbor in nodeData.in) return true;
    }
    if (this.type !== "directed") {
      if (neighbor in nodeData.undirected) return true;
    }
    return false;
  }
  /**
   * Method returning whether two nodes are outbound neighbors.
   *
   * @param  {any}     node     - The node's key.
   * @param  {any}     neighbor - The neighbor's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  areOutboundNeighbors(node, neighbor) {
    node = "" + node;
    neighbor = "" + neighbor;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.areOutboundNeighbors: could not find the "${node}" node in the graph.`
      );
    if (this.type !== "undirected") {
      if (neighbor in nodeData.out) return true;
    }
    if (this.type !== "directed") {
      if (neighbor in nodeData.undirected) return true;
    }
    return false;
  }
  /**
   * Method returning the given node's in degree.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's in degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  inDegree(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.inDegree: could not find the "${node}" node in the graph.`
      );
    if (this.type === "undirected") return 0;
    return nodeData.inDegree;
  }
  /**
   * Method returning the given node's out degree.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's in degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  outDegree(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.outDegree: could not find the "${node}" node in the graph.`
      );
    if (this.type === "undirected") return 0;
    return nodeData.outDegree;
  }
  /**
   * Method returning the given node's directed degree.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's in degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  directedDegree(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.directedDegree: could not find the "${node}" node in the graph.`
      );
    if (this.type === "undirected") return 0;
    return nodeData.inDegree + nodeData.outDegree;
  }
  /**
   * Method returning the given node's undirected degree.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's in degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  undirectedDegree(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.undirectedDegree: could not find the "${node}" node in the graph.`
      );
    if (this.type === "directed") return 0;
    return nodeData.undirectedDegree;
  }
  /**
   * Method returning the given node's inbound degree.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's inbound degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  inboundDegree(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.inboundDegree: could not find the "${node}" node in the graph.`
      );
    let degree = 0;
    if (this.type !== "directed") {
      degree += nodeData.undirectedDegree;
    }
    if (this.type !== "undirected") {
      degree += nodeData.inDegree;
    }
    return degree;
  }
  /**
   * Method returning the given node's outbound degree.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's outbound degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  outboundDegree(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.outboundDegree: could not find the "${node}" node in the graph.`
      );
    let degree = 0;
    if (this.type !== "directed") {
      degree += nodeData.undirectedDegree;
    }
    if (this.type !== "undirected") {
      degree += nodeData.outDegree;
    }
    return degree;
  }
  /**
   * Method returning the given node's directed degree.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  degree(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.degree: could not find the "${node}" node in the graph.`
      );
    let degree = 0;
    if (this.type !== "directed") {
      degree += nodeData.undirectedDegree;
    }
    if (this.type !== "undirected") {
      degree += nodeData.inDegree + nodeData.outDegree;
    }
    return degree;
  }
  /**
   * Method returning the given node's in degree without considering self loops.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's in degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  inDegreeWithoutSelfLoops(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.inDegreeWithoutSelfLoops: could not find the "${node}" node in the graph.`
      );
    if (this.type === "undirected") return 0;
    return nodeData.inDegree - nodeData.directedLoops;
  }
  /**
   * Method returning the given node's out degree without considering self loops.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's in degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  outDegreeWithoutSelfLoops(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.outDegreeWithoutSelfLoops: could not find the "${node}" node in the graph.`
      );
    if (this.type === "undirected") return 0;
    return nodeData.outDegree - nodeData.directedLoops;
  }
  /**
   * Method returning the given node's directed degree without considering self loops.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's in degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  directedDegreeWithoutSelfLoops(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.directedDegreeWithoutSelfLoops: could not find the "${node}" node in the graph.`
      );
    if (this.type === "undirected") return 0;
    return nodeData.inDegree + nodeData.outDegree - nodeData.directedLoops * 2;
  }
  /**
   * Method returning the given node's undirected degree without considering self loops.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's in degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  undirectedDegreeWithoutSelfLoops(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.undirectedDegreeWithoutSelfLoops: could not find the "${node}" node in the graph.`
      );
    if (this.type === "directed") return 0;
    return nodeData.undirectedDegree - nodeData.undirectedLoops * 2;
  }
  /**
   * Method returning the given node's inbound degree without considering self loops.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's inbound degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  inboundDegreeWithoutSelfLoops(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.inboundDegreeWithoutSelfLoops: could not find the "${node}" node in the graph.`
      );
    let degree = 0;
    let loops = 0;
    if (this.type !== "directed") {
      degree += nodeData.undirectedDegree;
      loops += nodeData.undirectedLoops * 2;
    }
    if (this.type !== "undirected") {
      degree += nodeData.inDegree;
      loops += nodeData.directedLoops;
    }
    return degree - loops;
  }
  /**
   * Method returning the given node's outbound degree without considering self loops.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's outbound degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  outboundDegreeWithoutSelfLoops(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.outboundDegreeWithoutSelfLoops: could not find the "${node}" node in the graph.`
      );
    let degree = 0;
    let loops = 0;
    if (this.type !== "directed") {
      degree += nodeData.undirectedDegree;
      loops += nodeData.undirectedLoops * 2;
    }
    if (this.type !== "undirected") {
      degree += nodeData.outDegree;
      loops += nodeData.directedLoops;
    }
    return degree - loops;
  }
  /**
   * Method returning the given node's directed degree without considering self loops.
   *
   * @param  {any}     node - The node's key.
   * @return {number}       - The node's degree.
   *
   * @throws {Error} - Will throw if the node isn't in the graph.
   */
  degreeWithoutSelfLoops(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.degreeWithoutSelfLoops: could not find the "${node}" node in the graph.`
      );
    let degree = 0;
    let loops = 0;
    if (this.type !== "directed") {
      degree += nodeData.undirectedDegree;
      loops += nodeData.undirectedLoops * 2;
    }
    if (this.type !== "undirected") {
      degree += nodeData.inDegree + nodeData.outDegree;
      loops += nodeData.directedLoops * 2;
    }
    return degree - loops;
  }
  /**
   * Method returning the given edge's source.
   *
   * @param  {any} edge - The edge's key.
   * @return {any}      - The edge's source.
   *
   * @throws {Error} - Will throw if the edge isn't in the graph.
   */
  source(edge2) {
    edge2 = "" + edge2;
    const data = this._edges.get(edge2);
    if (!data)
      throw new NotFoundGraphError(
        `Graph.source: could not find the "${edge2}" edge in the graph.`
      );
    return data.source.key;
  }
  /**
   * Method returning the given edge's target.
   *
   * @param  {any} edge - The edge's key.
   * @return {any}      - The edge's target.
   *
   * @throws {Error} - Will throw if the edge isn't in the graph.
   */
  target(edge2) {
    edge2 = "" + edge2;
    const data = this._edges.get(edge2);
    if (!data)
      throw new NotFoundGraphError(
        `Graph.target: could not find the "${edge2}" edge in the graph.`
      );
    return data.target.key;
  }
  /**
   * Method returning the given edge's extremities.
   *
   * @param  {any}   edge - The edge's key.
   * @return {array}      - The edge's extremities.
   *
   * @throws {Error} - Will throw if the edge isn't in the graph.
   */
  extremities(edge2) {
    edge2 = "" + edge2;
    const edgeData = this._edges.get(edge2);
    if (!edgeData)
      throw new NotFoundGraphError(
        `Graph.extremities: could not find the "${edge2}" edge in the graph.`
      );
    return [edgeData.source.key, edgeData.target.key];
  }
  /**
   * Given a node & an edge, returns the other extremity of the edge.
   *
   * @param  {any}   node - The node's key.
   * @param  {any}   edge - The edge's key.
   * @return {any}        - The related node.
   *
   * @throws {Error} - Will throw if the edge isn't in the graph or if the
   *                   edge & node are not related.
   */
  opposite(node, edge2) {
    node = "" + node;
    edge2 = "" + edge2;
    const data = this._edges.get(edge2);
    if (!data)
      throw new NotFoundGraphError(
        `Graph.opposite: could not find the "${edge2}" edge in the graph.`
      );
    const source = data.source.key;
    const target = data.target.key;
    if (node === source) return target;
    if (node === target) return source;
    throw new NotFoundGraphError(
      `Graph.opposite: the "${node}" node is not attached to the "${edge2}" edge (${source}, ${target}).`
    );
  }
  /**
   * Returns whether the given edge has the given node as extremity.
   *
   * @param  {any}     edge - The edge's key.
   * @param  {any}     node - The node's key.
   * @return {boolean}      - The related node.
   *
   * @throws {Error} - Will throw if either the node or the edge isn't in the graph.
   */
  hasExtremity(edge2, node) {
    edge2 = "" + edge2;
    node = "" + node;
    const data = this._edges.get(edge2);
    if (!data)
      throw new NotFoundGraphError(
        `Graph.hasExtremity: could not find the "${edge2}" edge in the graph.`
      );
    return data.source.key === node || data.target.key === node;
  }
  /**
   * Method returning whether the given edge is undirected.
   *
   * @param  {any}     edge - The edge's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the edge isn't in the graph.
   */
  isUndirected(edge2) {
    edge2 = "" + edge2;
    const data = this._edges.get(edge2);
    if (!data)
      throw new NotFoundGraphError(
        `Graph.isUndirected: could not find the "${edge2}" edge in the graph.`
      );
    return data.undirected;
  }
  /**
   * Method returning whether the given edge is directed.
   *
   * @param  {any}     edge - The edge's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the edge isn't in the graph.
   */
  isDirected(edge2) {
    edge2 = "" + edge2;
    const data = this._edges.get(edge2);
    if (!data)
      throw new NotFoundGraphError(
        `Graph.isDirected: could not find the "${edge2}" edge in the graph.`
      );
    return !data.undirected;
  }
  /**
   * Method returning whether the given edge is a self loop.
   *
   * @param  {any}     edge - The edge's key.
   * @return {boolean}
   *
   * @throws {Error} - Will throw if the edge isn't in the graph.
   */
  isSelfLoop(edge2) {
    edge2 = "" + edge2;
    const data = this._edges.get(edge2);
    if (!data)
      throw new NotFoundGraphError(
        `Graph.isSelfLoop: could not find the "${edge2}" edge in the graph.`
      );
    return data.source === data.target;
  }
  /**---------------------------------------------------------------------------
   * Mutation
   **---------------------------------------------------------------------------
   */
  /**
   * Method used to add a node to the graph.
   *
   * @param  {any}    node         - The node.
   * @param  {object} [attributes] - Optional attributes.
   * @return {any}                 - The node.
   *
   * @throws {Error} - Will throw if the given node already exist.
   * @throws {Error} - Will throw if the given attributes are not an object.
   */
  addNode(node, attributes) {
    const nodeData = addNode(this, node, attributes);
    return nodeData.key;
  }
  /**
   * Method used to merge a node into the graph.
   *
   * @param  {any}    node         - The node.
   * @param  {object} [attributes] - Optional attributes.
   * @return {any}                 - The node.
   */
  mergeNode(node, attributes) {
    if (attributes && !isPlainObject(attributes))
      throw new InvalidArgumentsGraphError(
        `Graph.mergeNode: invalid attributes. Expecting an object but got "${attributes}"`
      );
    node = "" + node;
    attributes = attributes || {};
    let data = this._nodes.get(node);
    if (data) {
      if (attributes) {
        assign(data.attributes, attributes);
        this.emit("nodeAttributesUpdated", {
          type: "merge",
          key: node,
          attributes: data.attributes,
          data: attributes
        });
      }
      return [node, false];
    }
    data = new this.NodeDataClass(node, attributes);
    this._nodes.set(node, data);
    this.emit("nodeAdded", {
      key: node,
      attributes
    });
    return [node, true];
  }
  /**
   * Method used to add a node if it does not exist in the graph or else to
   * update its attributes using a function.
   *
   * @param  {any}      node      - The node.
   * @param  {function} [updater] - Optional updater function.
   * @return {any}                - The node.
   */
  updateNode(node, updater) {
    if (updater && typeof updater !== "function")
      throw new InvalidArgumentsGraphError(
        `Graph.updateNode: invalid updater function. Expecting a function but got "${updater}"`
      );
    node = "" + node;
    let data = this._nodes.get(node);
    if (data) {
      if (updater) {
        const oldAttributes = data.attributes;
        data.attributes = updater(oldAttributes);
        this.emit("nodeAttributesUpdated", {
          type: "replace",
          key: node,
          attributes: data.attributes
        });
      }
      return [node, false];
    }
    const attributes = updater ? updater({}) : {};
    data = new this.NodeDataClass(node, attributes);
    this._nodes.set(node, data);
    this.emit("nodeAdded", {
      key: node,
      attributes
    });
    return [node, true];
  }
  /**
   * Method used to drop a single node & all its attached edges from the graph.
   *
   * @param  {any}    node - The node.
   * @return {Graph}
   *
   * @throws {Error} - Will throw if the node doesn't exist.
   */
  dropNode(node) {
    node = "" + node;
    const nodeData = this._nodes.get(node);
    if (!nodeData)
      throw new NotFoundGraphError(
        `Graph.dropNode: could not find the "${node}" node in the graph.`
      );
    let edgeData;
    if (this.type !== "undirected") {
      for (const neighbor in nodeData.out) {
        edgeData = nodeData.out[neighbor];
        do {
          dropEdgeFromData(this, edgeData);
          edgeData = edgeData.next;
        } while (edgeData);
      }
      for (const neighbor in nodeData.in) {
        edgeData = nodeData.in[neighbor];
        do {
          dropEdgeFromData(this, edgeData);
          edgeData = edgeData.next;
        } while (edgeData);
      }
    }
    if (this.type !== "directed") {
      for (const neighbor in nodeData.undirected) {
        edgeData = nodeData.undirected[neighbor];
        do {
          dropEdgeFromData(this, edgeData);
          edgeData = edgeData.next;
        } while (edgeData);
      }
    }
    this._nodes.delete(node);
    this.emit("nodeDropped", {
      key: node,
      attributes: nodeData.attributes
    });
  }
  /**
   * Method used to drop a single edge from the graph.
   *
   * Arity 1:
   * @param  {any}    edge - The edge.
   *
   * Arity 2:
   * @param  {any}    source - Source node.
   * @param  {any}    target - Target node.
   *
   * @return {Graph}
   *
   * @throws {Error} - Will throw if the edge doesn't exist.
   */
  dropEdge(edge2) {
    let edgeData;
    if (arguments.length > 1) {
      const source = "" + arguments[0];
      const target = "" + arguments[1];
      edgeData = getMatchingEdge(this, source, target, this.type);
      if (!edgeData)
        throw new NotFoundGraphError(
          `Graph.dropEdge: could not find the "${source}" -> "${target}" edge in the graph.`
        );
    } else {
      edge2 = "" + edge2;
      edgeData = this._edges.get(edge2);
      if (!edgeData)
        throw new NotFoundGraphError(
          `Graph.dropEdge: could not find the "${edge2}" edge in the graph.`
        );
    }
    dropEdgeFromData(this, edgeData);
    return this;
  }
  /**
   * Method used to drop a single directed edge from the graph.
   *
   * @param  {any}    source - Source node.
   * @param  {any}    target - Target node.
   *
   * @return {Graph}
   *
   * @throws {Error} - Will throw if the edge doesn't exist.
   */
  dropDirectedEdge(source, target) {
    if (arguments.length < 2)
      throw new UsageGraphError(
        "Graph.dropDirectedEdge: it does not make sense to try and drop a directed edge by key. What if the edge with this key is undirected? Use #.dropEdge for this purpose instead."
      );
    if (this.multi)
      throw new UsageGraphError(
        "Graph.dropDirectedEdge: cannot use a {source,target} combo when dropping an edge in a MultiGraph since we cannot infer the one you want to delete as there could be multiple ones."
      );
    source = "" + source;
    target = "" + target;
    const edgeData = getMatchingEdge(this, source, target, "directed");
    if (!edgeData)
      throw new NotFoundGraphError(
        `Graph.dropDirectedEdge: could not find a "${source}" -> "${target}" edge in the graph.`
      );
    dropEdgeFromData(this, edgeData);
    return this;
  }
  /**
   * Method used to drop a single undirected edge from the graph.
   *
   * @param  {any}    source - Source node.
   * @param  {any}    target - Target node.
   *
   * @return {Graph}
   *
   * @throws {Error} - Will throw if the edge doesn't exist.
   */
  dropUndirectedEdge(source, target) {
    if (arguments.length < 2)
      throw new UsageGraphError(
        "Graph.dropUndirectedEdge: it does not make sense to drop a directed edge by key. What if the edge with this key is undirected? Use #.dropEdge for this purpose instead."
      );
    if (this.multi)
      throw new UsageGraphError(
        "Graph.dropUndirectedEdge: cannot use a {source,target} combo when dropping an edge in a MultiGraph since we cannot infer the one you want to delete as there could be multiple ones."
      );
    const edgeData = getMatchingEdge(this, source, target, "undirected");
    if (!edgeData)
      throw new NotFoundGraphError(
        `Graph.dropUndirectedEdge: could not find a "${source}" -> "${target}" edge in the graph.`
      );
    dropEdgeFromData(this, edgeData);
    return this;
  }
  /**
   * Method used to remove every edge & every node from the graph.
   *
   * @return {Graph}
   */
  clear() {
    this._edges.clear();
    this._nodes.clear();
    this._resetInstanceCounters();
    this.emit("cleared");
  }
  /**
   * Method used to remove every edge from the graph.
   *
   * @return {Graph}
   */
  clearEdges() {
    const iterator = this._nodes.values();
    let step;
    while (step = iterator.next(), step.done !== true) {
      step.value.clear();
    }
    this._edges.clear();
    this._resetInstanceCounters();
    this.emit("edgesCleared");
  }
  /**---------------------------------------------------------------------------
   * Attributes-related methods
   **---------------------------------------------------------------------------
   */
  /**
   * Method returning the desired graph's attribute.
   *
   * @param  {string} name - Name of the attribute.
   * @return {any}
   */
  getAttribute(name2) {
    return this._attributes[name2];
  }
  /**
   * Method returning the graph's attributes.
   *
   * @return {object}
   */
  getAttributes() {
    return this._attributes;
  }
  /**
   * Method returning whether the graph has the desired attribute.
   *
   * @param  {string}  name - Name of the attribute.
   * @return {boolean}
   */
  hasAttribute(name2) {
    return this._attributes.hasOwnProperty(name2);
  }
  /**
   * Method setting a value for the desired graph's attribute.
   *
   * @param  {string}  name  - Name of the attribute.
   * @param  {any}     value - Value for the attribute.
   * @return {Graph}
   */
  setAttribute(name2, value) {
    this._attributes[name2] = value;
    this.emit("attributesUpdated", {
      type: "set",
      attributes: this._attributes,
      name: name2
    });
    return this;
  }
  /**
   * Method using a function to update the desired graph's attribute's value.
   *
   * @param  {string}   name    - Name of the attribute.
   * @param  {function} updater - Function use to update the attribute's value.
   * @return {Graph}
   */
  updateAttribute(name2, updater) {
    if (typeof updater !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.updateAttribute: updater should be a function."
      );
    const value = this._attributes[name2];
    this._attributes[name2] = updater(value);
    this.emit("attributesUpdated", {
      type: "set",
      attributes: this._attributes,
      name: name2
    });
    return this;
  }
  /**
   * Method removing the desired graph's attribute.
   *
   * @param  {string} name  - Name of the attribute.
   * @return {Graph}
   */
  removeAttribute(name2) {
    delete this._attributes[name2];
    this.emit("attributesUpdated", {
      type: "remove",
      attributes: this._attributes,
      name: name2
    });
    return this;
  }
  /**
   * Method replacing the graph's attributes.
   *
   * @param  {object} attributes - New attributes.
   * @return {Graph}
   *
   * @throws {Error} - Will throw if given attributes are not a plain object.
   */
  replaceAttributes(attributes) {
    if (!isPlainObject(attributes))
      throw new InvalidArgumentsGraphError(
        "Graph.replaceAttributes: provided attributes are not a plain object."
      );
    this._attributes = attributes;
    this.emit("attributesUpdated", {
      type: "replace",
      attributes: this._attributes
    });
    return this;
  }
  /**
   * Method merging the graph's attributes.
   *
   * @param  {object} attributes - Attributes to merge.
   * @return {Graph}
   *
   * @throws {Error} - Will throw if given attributes are not a plain object.
   */
  mergeAttributes(attributes) {
    if (!isPlainObject(attributes))
      throw new InvalidArgumentsGraphError(
        "Graph.mergeAttributes: provided attributes are not a plain object."
      );
    assign(this._attributes, attributes);
    this.emit("attributesUpdated", {
      type: "merge",
      attributes: this._attributes,
      data: attributes
    });
    return this;
  }
  /**
   * Method updating the graph's attributes.
   *
   * @param  {function} updater - Function used to update the attributes.
   * @return {Graph}
   *
   * @throws {Error} - Will throw if given updater is not a function.
   */
  updateAttributes(updater) {
    if (typeof updater !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.updateAttributes: provided updater is not a function."
      );
    this._attributes = updater(this._attributes);
    this.emit("attributesUpdated", {
      type: "update",
      attributes: this._attributes
    });
    return this;
  }
  /**
   * Method used to update each node's attributes using the given function.
   *
   * @param {function}  updater - Updater function to use.
   * @param {object}    [hints] - Optional hints.
   */
  updateEachNodeAttributes(updater, hints) {
    if (typeof updater !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.updateEachNodeAttributes: expecting an updater function."
      );
    if (hints && !validateHints(hints))
      throw new InvalidArgumentsGraphError(
        "Graph.updateEachNodeAttributes: invalid hints. Expecting an object having the following shape: {attributes?: [string]}"
      );
    const iterator = this._nodes.values();
    let step, nodeData;
    while (step = iterator.next(), step.done !== true) {
      nodeData = step.value;
      nodeData.attributes = updater(nodeData.key, nodeData.attributes);
    }
    this.emit("eachNodeAttributesUpdated", {
      hints: hints ? hints : null
    });
  }
  /**
   * Method used to update each edge's attributes using the given function.
   *
   * @param {function}  updater - Updater function to use.
   * @param {object}    [hints] - Optional hints.
   */
  updateEachEdgeAttributes(updater, hints) {
    if (typeof updater !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.updateEachEdgeAttributes: expecting an updater function."
      );
    if (hints && !validateHints(hints))
      throw new InvalidArgumentsGraphError(
        "Graph.updateEachEdgeAttributes: invalid hints. Expecting an object having the following shape: {attributes?: [string]}"
      );
    const iterator = this._edges.values();
    let step, edgeData, sourceData, targetData;
    while (step = iterator.next(), step.done !== true) {
      edgeData = step.value;
      sourceData = edgeData.source;
      targetData = edgeData.target;
      edgeData.attributes = updater(
        edgeData.key,
        edgeData.attributes,
        sourceData.key,
        targetData.key,
        sourceData.attributes,
        targetData.attributes,
        edgeData.undirected
      );
    }
    this.emit("eachEdgeAttributesUpdated", {
      hints: hints ? hints : null
    });
  }
  /**---------------------------------------------------------------------------
   * Iteration-related methods
   **---------------------------------------------------------------------------
   */
  /**
   * Method iterating over the graph's adjacency using the given callback.
   *
   * @param  {function}  callback - Callback to use.
   */
  forEachAdjacencyEntry(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.forEachAdjacencyEntry: expecting a callback."
      );
    forEachAdjacency(false, false, false, this, callback);
  }
  forEachAdjacencyEntryWithOrphans(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.forEachAdjacencyEntryWithOrphans: expecting a callback."
      );
    forEachAdjacency(false, false, true, this, callback);
  }
  /**
   * Method iterating over the graph's assymetric adjacency using the given callback.
   *
   * @param  {function}  callback - Callback to use.
   */
  forEachAssymetricAdjacencyEntry(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.forEachAssymetricAdjacencyEntry: expecting a callback."
      );
    forEachAdjacency(false, true, false, this, callback);
  }
  forEachAssymetricAdjacencyEntryWithOrphans(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.forEachAssymetricAdjacencyEntryWithOrphans: expecting a callback."
      );
    forEachAdjacency(false, true, true, this, callback);
  }
  /**
   * Method returning the list of the graph's nodes.
   *
   * @return {array} - The nodes.
   */
  nodes() {
    return Array.from(this._nodes.keys());
  }
  /**
   * Method iterating over the graph's nodes using the given callback.
   *
   * @param  {function}  callback - Callback (key, attributes, index).
   */
  forEachNode(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.forEachNode: expecting a callback."
      );
    const iterator = this._nodes.values();
    let step, nodeData;
    while (step = iterator.next(), step.done !== true) {
      nodeData = step.value;
      callback(nodeData.key, nodeData.attributes);
    }
  }
  /**
   * Method iterating attempting to find a node matching the given predicate
   * function.
   *
   * @param  {function}  callback - Callback (key, attributes).
   */
  findNode(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.findNode: expecting a callback."
      );
    const iterator = this._nodes.values();
    let step, nodeData;
    while (step = iterator.next(), step.done !== true) {
      nodeData = step.value;
      if (callback(nodeData.key, nodeData.attributes)) return nodeData.key;
    }
    return;
  }
  /**
   * Method mapping nodes.
   *
   * @param  {function}  callback - Callback (key, attributes).
   */
  mapNodes(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.mapNode: expecting a callback."
      );
    const iterator = this._nodes.values();
    let step, nodeData;
    const result = new Array(this.order);
    let i2 = 0;
    while (step = iterator.next(), step.done !== true) {
      nodeData = step.value;
      result[i2++] = callback(nodeData.key, nodeData.attributes);
    }
    return result;
  }
  /**
   * Method returning whether some node verify the given predicate.
   *
   * @param  {function}  callback - Callback (key, attributes).
   */
  someNode(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.someNode: expecting a callback."
      );
    const iterator = this._nodes.values();
    let step, nodeData;
    while (step = iterator.next(), step.done !== true) {
      nodeData = step.value;
      if (callback(nodeData.key, nodeData.attributes)) return true;
    }
    return false;
  }
  /**
   * Method returning whether all node verify the given predicate.
   *
   * @param  {function}  callback - Callback (key, attributes).
   */
  everyNode(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.everyNode: expecting a callback."
      );
    const iterator = this._nodes.values();
    let step, nodeData;
    while (step = iterator.next(), step.done !== true) {
      nodeData = step.value;
      if (!callback(nodeData.key, nodeData.attributes)) return false;
    }
    return true;
  }
  /**
   * Method filtering nodes.
   *
   * @param  {function}  callback - Callback (key, attributes).
   */
  filterNodes(callback) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.filterNodes: expecting a callback."
      );
    const iterator = this._nodes.values();
    let step, nodeData;
    const result = [];
    while (step = iterator.next(), step.done !== true) {
      nodeData = step.value;
      if (callback(nodeData.key, nodeData.attributes))
        result.push(nodeData.key);
    }
    return result;
  }
  /**
   * Method reducing nodes.
   *
   * @param  {function}  callback - Callback (accumulator, key, attributes).
   */
  reduceNodes(callback, initialValue) {
    if (typeof callback !== "function")
      throw new InvalidArgumentsGraphError(
        "Graph.reduceNodes: expecting a callback."
      );
    if (arguments.length < 2)
      throw new InvalidArgumentsGraphError(
        "Graph.reduceNodes: missing initial value. You must provide it because the callback takes more than one argument and we cannot infer the initial value from the first iteration, as you could with a simple array."
      );
    let accumulator = initialValue;
    const iterator = this._nodes.values();
    let step, nodeData;
    while (step = iterator.next(), step.done !== true) {
      nodeData = step.value;
      accumulator = callback(accumulator, nodeData.key, nodeData.attributes);
    }
    return accumulator;
  }
  /**
   * Method returning an iterator over the graph's node entries.
   *
   * @return {Iterator}
   */
  nodeEntries() {
    const iterator = this._nodes.values();
    return {
      [Symbol.iterator]() {
        return this;
      },
      next() {
        const step = iterator.next();
        if (step.done) return step;
        const data = step.value;
        return {
          value: { node: data.key, attributes: data.attributes },
          done: false
        };
      }
    };
  }
  /**---------------------------------------------------------------------------
   * Serialization
   **---------------------------------------------------------------------------
   */
  /**
   * Method used to export the whole graph.
   *
   * @return {object} - The serialized graph.
   */
  export() {
    const nodes = new Array(this._nodes.size);
    let i2 = 0;
    this._nodes.forEach((data, key) => {
      nodes[i2++] = serializeNode(key, data);
    });
    const edges = new Array(this._edges.size);
    i2 = 0;
    this._edges.forEach((data, key) => {
      edges[i2++] = serializeEdge(this.type, key, data);
    });
    return {
      options: {
        type: this.type,
        multi: this.multi,
        allowSelfLoops: this.allowSelfLoops
      },
      attributes: this.getAttributes(),
      nodes,
      edges
    };
  }
  /**
   * Method used to import a serialized graph.
   *
   * @param  {object|Graph} data  - The serialized graph.
   * @param  {boolean}      merge - Whether to merge data.
   * @return {Graph}              - Returns itself for chaining.
   */
  import(data, merge = false) {
    if (data instanceof _Graph) {
      data.forEachNode((n, a) => {
        if (merge) this.mergeNode(n, a);
        else this.addNode(n, a);
      });
      data.forEachEdge((e, a, s, t, _sa, _ta, u) => {
        if (merge) {
          if (u) this.mergeUndirectedEdgeWithKey(e, s, t, a);
          else this.mergeDirectedEdgeWithKey(e, s, t, a);
        } else {
          if (u) this.addUndirectedEdgeWithKey(e, s, t, a);
          else this.addDirectedEdgeWithKey(e, s, t, a);
        }
      });
      return this;
    }
    if (!isPlainObject(data))
      throw new InvalidArgumentsGraphError(
        "Graph.import: invalid argument. Expecting a serialized graph or, alternatively, a Graph instance."
      );
    if (data.attributes) {
      if (!isPlainObject(data.attributes))
        throw new InvalidArgumentsGraphError(
          "Graph.import: invalid attributes. Expecting a plain object."
        );
      if (merge) this.mergeAttributes(data.attributes);
      else this.replaceAttributes(data.attributes);
    }
    let i2, l, list, node, edge2;
    if (data.nodes) {
      list = data.nodes;
      if (!Array.isArray(list))
        throw new InvalidArgumentsGraphError(
          "Graph.import: invalid nodes. Expecting an array."
        );
      for (i2 = 0, l = list.length; i2 < l; i2++) {
        node = list[i2];
        validateSerializedNode(node);
        const { key, attributes } = node;
        if (merge) this.mergeNode(key, attributes);
        else this.addNode(key, attributes);
      }
    }
    if (data.edges) {
      let undirectedByDefault = false;
      if (this.type === "undirected") {
        undirectedByDefault = true;
      }
      list = data.edges;
      if (!Array.isArray(list))
        throw new InvalidArgumentsGraphError(
          "Graph.import: invalid edges. Expecting an array."
        );
      for (i2 = 0, l = list.length; i2 < l; i2++) {
        edge2 = list[i2];
        validateSerializedEdge(edge2);
        const {
          source,
          target,
          attributes,
          undirected = undirectedByDefault
        } = edge2;
        let method;
        if ("key" in edge2) {
          method = merge ? undirected ? this.mergeUndirectedEdgeWithKey : this.mergeDirectedEdgeWithKey : undirected ? this.addUndirectedEdgeWithKey : this.addDirectedEdgeWithKey;
          method.call(this, edge2.key, source, target, attributes);
        } else {
          method = merge ? undirected ? this.mergeUndirectedEdge : this.mergeDirectedEdge : undirected ? this.addUndirectedEdge : this.addDirectedEdge;
          method.call(this, source, target, attributes);
        }
      }
    }
    return this;
  }
  /**---------------------------------------------------------------------------
   * Utils
   **---------------------------------------------------------------------------
   */
  /**
   * Method returning a null copy of the graph, i.e. a graph without nodes
   * & edges but with the exact same options.
   *
   * @param  {object} options - Options to merge with the current ones.
   * @return {Graph}          - The null copy.
   */
  nullCopy(options) {
    const graph = new _Graph(assign({}, this._options, options));
    graph.replaceAttributes(assign({}, this.getAttributes()));
    return graph;
  }
  /**
   * Method returning an empty copy of the graph, i.e. a graph without edges but
   * with the exact same options.
   *
   * @param  {object} options - Options to merge with the current ones.
   * @return {Graph}          - The empty copy.
   */
  emptyCopy(options) {
    const graph = this.nullCopy(options);
    this._nodes.forEach((nodeData, key) => {
      const attributes = assign({}, nodeData.attributes);
      nodeData = new graph.NodeDataClass(key, attributes);
      graph._nodes.set(key, nodeData);
    });
    return graph;
  }
  /**
   * Method returning an exact copy of the graph.
   *
   * @param  {object} options - Upgrade options.
   * @return {Graph}          - The copy.
   */
  copy(options) {
    options = options || {};
    if (typeof options.type === "string" && options.type !== this.type && options.type !== "mixed")
      throw new UsageGraphError(
        `Graph.copy: cannot create an incompatible copy from "${this.type}" type to "${options.type}" because this would mean losing information about the current graph.`
      );
    if (typeof options.multi === "boolean" && options.multi !== this.multi && options.multi !== true)
      throw new UsageGraphError(
        "Graph.copy: cannot create an incompatible copy by downgrading a multi graph to a simple one because this would mean losing information about the current graph."
      );
    if (typeof options.allowSelfLoops === "boolean" && options.allowSelfLoops !== this.allowSelfLoops && options.allowSelfLoops !== true)
      throw new UsageGraphError(
        "Graph.copy: cannot create an incompatible copy from a graph allowing self loops to one that does not because this would mean losing information about the current graph."
      );
    const graph = this.emptyCopy(options);
    const iterator = this._edges.values();
    let step, edgeData;
    while (step = iterator.next(), step.done !== true) {
      edgeData = step.value;
      addEdge(
        graph,
        "copy",
        false,
        edgeData.undirected,
        edgeData.key,
        edgeData.source.key,
        edgeData.target.key,
        assign({}, edgeData.attributes)
      );
    }
    return graph;
  }
  /**---------------------------------------------------------------------------
   * Known methods
   **---------------------------------------------------------------------------
   */
  /**
   * Method used by JavaScript to perform JSON serialization.
   *
   * @return {object} - The serialized graph.
   */
  toJSON() {
    return this.export();
  }
  /**
   * Method returning [object Graph].
   */
  toString() {
    return "[object Graph]";
  }
  /**
   * Method used internally by node's console to display a custom object.
   *
   * @return {object} - Formatted object representation of the graph.
   */
  inspect() {
    const nodes = {};
    this._nodes.forEach((data, key) => {
      nodes[key] = data.attributes;
    });
    const edges = {}, multiIndex = {};
    this._edges.forEach((data, key) => {
      const direction = data.undirected ? "--" : "->";
      let label = "";
      let source = data.source.key;
      let target = data.target.key;
      let tmp;
      if (data.undirected && source > target) {
        tmp = source;
        source = target;
        target = tmp;
      }
      const desc = `(${source})${direction}(${target})`;
      if (!key.startsWith("geid_")) {
        label += `[${key}]: `;
      } else if (this.multi) {
        if (typeof multiIndex[desc] === "undefined") {
          multiIndex[desc] = 0;
        } else {
          multiIndex[desc]++;
        }
        label += `${multiIndex[desc]}. `;
      }
      label += desc;
      edges[label] = data.attributes;
    });
    const dummy = {};
    for (const k in this) {
      if (this.hasOwnProperty(k) && !EMITTER_PROPS.has(k) && typeof this[k] !== "function" && typeof k !== "symbol")
        dummy[k] = this[k];
    }
    dummy.attributes = this._attributes;
    dummy.nodes = nodes;
    dummy.edges = edges;
    privateProperty(dummy, "constructor", this.constructor);
    return dummy;
  }
};
if (typeof Symbol !== "undefined")
  Graph.prototype[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = Graph.prototype.inspect;
EDGE_ADD_METHODS.forEach((method) => {
  ["add", "merge", "update"].forEach((verb) => {
    const name2 = method.name(verb);
    const fn2 = verb === "add" ? addEdge : mergeEdge;
    if (method.generateKey) {
      Graph.prototype[name2] = function(source, target, attributes) {
        return fn2(
          this,
          name2,
          true,
          (method.type || this.type) === "undirected",
          null,
          source,
          target,
          attributes,
          verb === "update"
        );
      };
    } else {
      Graph.prototype[name2] = function(edge2, source, target, attributes) {
        return fn2(
          this,
          name2,
          false,
          (method.type || this.type) === "undirected",
          edge2,
          source,
          target,
          attributes,
          verb === "update"
        );
      };
    }
  });
});
attachNodeAttributesMethods(Graph);
attachEdgeAttributesMethods(Graph);
attachEdgeIterationMethods(Graph);
attachNeighborIterationMethods(Graph);
var DirectedGraph = class extends Graph {
  constructor(options) {
    const finalOptions = assign({ type: "directed" }, options);
    if ("multi" in finalOptions && finalOptions.multi !== false)
      throw new InvalidArgumentsGraphError(
        "DirectedGraph.from: inconsistent indication that the graph should be multi in given options!"
      );
    if (finalOptions.type !== "directed")
      throw new InvalidArgumentsGraphError(
        'DirectedGraph.from: inconsistent "' + finalOptions.type + '" type in given options!'
      );
    super(finalOptions);
  }
};
var UndirectedGraph = class extends Graph {
  constructor(options) {
    const finalOptions = assign({ type: "undirected" }, options);
    if ("multi" in finalOptions && finalOptions.multi !== false)
      throw new InvalidArgumentsGraphError(
        "UndirectedGraph.from: inconsistent indication that the graph should be multi in given options!"
      );
    if (finalOptions.type !== "undirected")
      throw new InvalidArgumentsGraphError(
        'UndirectedGraph.from: inconsistent "' + finalOptions.type + '" type in given options!'
      );
    super(finalOptions);
  }
};
var MultiGraph = class extends Graph {
  constructor(options) {
    const finalOptions = assign({ multi: true }, options);
    if ("multi" in finalOptions && finalOptions.multi !== true)
      throw new InvalidArgumentsGraphError(
        "MultiGraph.from: inconsistent indication that the graph should be simple in given options!"
      );
    super(finalOptions);
  }
};
var MultiDirectedGraph = class extends Graph {
  constructor(options) {
    const finalOptions = assign({ type: "directed", multi: true }, options);
    if ("multi" in finalOptions && finalOptions.multi !== true)
      throw new InvalidArgumentsGraphError(
        "MultiDirectedGraph.from: inconsistent indication that the graph should be simple in given options!"
      );
    if (finalOptions.type !== "directed")
      throw new InvalidArgumentsGraphError(
        'MultiDirectedGraph.from: inconsistent "' + finalOptions.type + '" type in given options!'
      );
    super(finalOptions);
  }
};
var MultiUndirectedGraph = class extends Graph {
  constructor(options) {
    const finalOptions = assign({ type: "undirected", multi: true }, options);
    if ("multi" in finalOptions && finalOptions.multi !== true)
      throw new InvalidArgumentsGraphError(
        "MultiUndirectedGraph.from: inconsistent indication that the graph should be simple in given options!"
      );
    if (finalOptions.type !== "undirected")
      throw new InvalidArgumentsGraphError(
        'MultiUndirectedGraph.from: inconsistent "' + finalOptions.type + '" type in given options!'
      );
    super(finalOptions);
  }
};
function attachStaticFromMethod(Class) {
  Class.from = function(data, options) {
    const finalOptions = assign({}, data.options, options);
    const instance2 = new Class(finalOptions);
    instance2.import(data);
    return instance2;
  };
}
attachStaticFromMethod(Graph);
attachStaticFromMethod(DirectedGraph);
attachStaticFromMethod(UndirectedGraph);
attachStaticFromMethod(MultiGraph);
attachStaticFromMethod(MultiDirectedGraph);
attachStaticFromMethod(MultiUndirectedGraph);
Graph.Graph = Graph;
Graph.DirectedGraph = DirectedGraph;
Graph.UndirectedGraph = UndirectedGraph;
Graph.MultiGraph = MultiGraph;
Graph.MultiDirectedGraph = MultiDirectedGraph;
Graph.MultiUndirectedGraph = MultiUndirectedGraph;
Graph.InvalidArgumentsGraphError = InvalidArgumentsGraphError;
Graph.NotFoundGraphError = NotFoundGraphError;
Graph.UsageGraphError = UsageGraphError;

// engine/src/cluster.ts
var import_graphology_communities_louvain = __toESM(require_graphology_communities_louvain(), 1);
var import_graphology_operators = __toESM(require_graphology_operators(), 1);
function rng(seed = 42) {
  let a = seed;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function partition(g, resolution) {
  if (g.size === 0) return g.nodes().sort().map((n) => [n]);
  const assignment = (0, import_graphology_communities_louvain.default)(g, { resolution, rng: rng(), getEdgeWeight: "weight" });
  const groups = /* @__PURE__ */ new Map();
  for (const [node, c] of Object.entries(assignment)) groups.set(c, [...groups.get(c) ?? [], node]);
  return [...groups.values()];
}
function cohesion(g, members) {
  const n = members.length;
  if (n <= 1) return 1;
  const set = new Set(members);
  let internal = 0;
  g.forEachEdge((_e, _a, s, t) => {
    if (s !== t && set.has(s) && set.has(t)) internal++;
  });
  return internal / (n * (n - 1) / 2);
}
function cluster(g, resolution = 1) {
  const isolates = g.filterNodes((n) => g.degree(n) === 0);
  const connected = (0, import_graphology_operators.subgraph)(g, g.filterNodes((n) => g.degree(n) > 0));
  let parts2 = partition(connected, resolution);
  const maxSize = Math.max(10, Math.floor(g.order * 0.25));
  parts2 = parts2.flatMap((members) => {
    const tooBig = members.length > maxSize;
    const loose = members.length >= 50 && cohesion(g, members) < 0.05;
    if (!tooBig && !loose) return [members];
    const sub = (0, import_graphology_operators.subgraph)(connected, members);
    const split = sub.size === 0 ? members.map((m) => [m]) : partition(sub, resolution);
    return split.length > 1 ? split : [members];
  });
  parts2.push(...isolates.map((n) => [n]));
  parts2 = parts2.map((p) => [...p].sort());
  parts2.sort((a, b) => b.length - a.length || a.join("\0").localeCompare(b.join("\0")));
  return new Map(parts2.map((p, i2) => [i2, p]));
}
function nameCommunities(g, communities) {
  const names = /* @__PURE__ */ new Map();
  for (const [cid, members] of communities) {
    let best = null;
    for (const m of members) {
      if (best === null || g.degree(m) > g.degree(best) || g.degree(m) === g.degree(best) && m < best) best = m;
    }
    const label = best ? g.getNodeAttribute(best, "label") ?? best : "";
    names.set(cid, label.replace(/\(\)$/, "") || `Comunidade ${cid}`);
  }
  return names;
}

// engine/src/resolve.ts
import path3 from "node:path";

// engine/src/ids.ts
import path from "node:path";
function normalizeId(s) {
  let cur = s;
  for (let i2 = 0; i2 < 6; i2++) {
    const next = cur.normalize("NFKC").toLocaleLowerCase("und").replace(/ß/g, "ss");
    if (next === cur) break;
    cur = next;
  }
  return cur.replace(/[^\p{L}\p{N}\p{M}\p{Pc}]+/gu, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}
function makeId(...parts2) {
  return normalizeId(
    parts2.filter((p) => !!p).map((p) => p.replace(/^[_.]+|[_.]+$/g, "")).join("_")
  );
}
function fileStem(relPath) {
  const ext = path.posix.extname(relPath);
  return ext ? relPath.slice(0, -ext.length) : relPath;
}
var fileNodeId = (relPath) => makeId(fileStem(relPath));
var bareLabel = (label) => label.replace(/\(\)$/, "").replace(/^\./, "");
var normLabel = (label) => label.normalize("NFKD").replace(new RegExp("\\p{M}+", "gu"), "").toLowerCase();

// engine/src/languages.ts
import path2 from "node:path";
var S = (...xs) => new Set(xs);
var JS_BOUNDARY = S(
  "function_declaration",
  "generator_function_declaration",
  "arrow_function",
  "method_definition",
  "function_expression",
  "generator_function"
);
var TS_BASE = {
  family: "js",
  classTypes: S("class_declaration", "abstract_class_declaration", "interface_declaration", "enum_declaration", "type_alias_declaration"),
  functionTypes: S("function_declaration", "generator_function_declaration", "method_definition", "method_signature"),
  importTypes: S("import_statement", "export_statement"),
  callTypes: S("call_expression", "new_expression"),
  callFunctionField: "function",
  accessorTypes: S("member_expression"),
  accessorField: "property",
  accessorObjectField: "object",
  boundaryTypes: JS_BOUNDARY,
  importStyle: "js",
  js: true
};
var LANGUAGES = [
  { name: "typescript", grammar: "typescript", extensions: [".ts", ".mts", ".cts"], ...TS_BASE },
  {
    name: "tsx",
    grammar: "tsx",
    extensions: [".tsx"],
    ...TS_BASE,
    // Uso de componente JSX (`<Comp />`) conta como chamada.
    callTypes: S("call_expression", "new_expression", "jsx_opening_element", "jsx_self_closing_element")
  },
  {
    name: "javascript",
    grammar: "javascript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    ...TS_BASE,
    classTypes: S("class_declaration"),
    functionTypes: S("function_declaration", "generator_function_declaration", "method_definition"),
    callTypes: S("call_expression", "new_expression", "jsx_opening_element", "jsx_self_closing_element")
  },
  {
    name: "python",
    grammar: "python",
    extensions: [".py", ".pyi"],
    family: "python",
    classTypes: S("class_definition"),
    functionTypes: S("function_definition"),
    importTypes: S("import_statement", "import_from_statement"),
    callTypes: S("call"),
    callFunctionField: "function",
    accessorTypes: S("attribute"),
    accessorField: "attribute",
    accessorObjectField: "object",
    boundaryTypes: S("function_definition"),
    importStyle: "python"
  },
  {
    name: "java",
    grammar: "java",
    extensions: [".java"],
    family: "jvm",
    classTypes: S("class_declaration", "interface_declaration", "record_declaration", "enum_declaration", "annotation_type_declaration"),
    functionTypes: S("method_declaration", "constructor_declaration"),
    importTypes: S("import_declaration"),
    callTypes: S("method_invocation", "object_creation_expression"),
    callFunctionField: "name",
    accessorTypes: S(),
    accessorField: "name",
    accessorObjectField: "object",
    boundaryTypes: S("method_declaration", "constructor_declaration"),
    importStyle: "java"
  },
  {
    name: "kotlin",
    grammar: "kotlin",
    extensions: [".kt", ".kts"],
    family: "jvm",
    classTypes: S("class_declaration", "object_declaration"),
    functionTypes: S("function_declaration"),
    importTypes: S("import_header", "import"),
    callTypes: S("call_expression"),
    callFunctionField: "",
    accessorTypes: S("navigation_expression"),
    accessorField: "",
    accessorObjectField: "",
    nameFallback: ["simple_identifier", "identifier", "type_identifier"],
    bodyFallback: ["function_body", "class_body", "enum_class_body"],
    boundaryTypes: S("function_declaration"),
    importStyle: "kotlin"
  },
  {
    name: "scala",
    grammar: "scala",
    extensions: [".scala"],
    family: "jvm",
    classTypes: S("class_definition", "object_definition", "trait_definition"),
    functionTypes: S("function_definition"),
    importTypes: S("import_declaration"),
    callTypes: S("call_expression"),
    callFunctionField: "",
    accessorTypes: S("field_expression"),
    accessorField: "field",
    accessorObjectField: "value",
    nameFallback: ["identifier"],
    bodyFallback: ["template_body"],
    boundaryTypes: S("function_definition"),
    importStyle: "none"
  },
  {
    name: "csharp",
    grammar: "c_sharp",
    extensions: [".cs"],
    family: "dotnet",
    classTypes: S("class_declaration", "interface_declaration", "enum_declaration", "struct_declaration", "record_declaration"),
    functionTypes: S("method_declaration"),
    importTypes: S("using_directive"),
    callTypes: S("invocation_expression", "object_creation_expression"),
    callFunctionField: "function",
    accessorTypes: S("member_access_expression"),
    accessorField: "name",
    accessorObjectField: "expression",
    bodyFallback: ["declaration_list"],
    boundaryTypes: S("method_declaration"),
    importStyle: "csharp"
  },
  {
    name: "go",
    grammar: "go",
    extensions: [".go"],
    family: "go",
    classTypes: S("type_spec"),
    functionTypes: S("function_declaration", "method_declaration"),
    importTypes: S("import_declaration"),
    callTypes: S("call_expression"),
    callFunctionField: "function",
    accessorTypes: S("selector_expression"),
    accessorField: "field",
    accessorObjectField: "operand",
    boundaryTypes: S("function_declaration", "method_declaration", "func_literal"),
    importStyle: "go"
  },
  {
    name: "rust",
    grammar: "rust",
    extensions: [".rs"],
    family: "rust",
    classTypes: S("struct_item", "enum_item", "trait_item", "impl_item"),
    nameFieldByType: { impl_item: "type" },
    functionTypes: S("function_item", "function_signature_item"),
    importTypes: S("use_declaration"),
    callTypes: S("call_expression"),
    callFunctionField: "function",
    accessorTypes: S("field_expression", "scoped_identifier"),
    accessorField: "field",
    accessorObjectField: "value",
    boundaryTypes: S("function_item", "closure_expression"),
    importStyle: "rust"
  },
  {
    name: "php",
    grammar: "php",
    extensions: [".php"],
    family: "php",
    classTypes: S("class_declaration", "interface_declaration", "enum_declaration", "trait_declaration"),
    functionTypes: S("function_definition", "method_declaration"),
    importTypes: S("namespace_use_clause"),
    callTypes: S("function_call_expression", "member_call_expression", "scoped_call_expression", "object_creation_expression"),
    callFunctionField: "function",
    accessorTypes: S("member_call_expression"),
    accessorField: "name",
    accessorObjectField: "object",
    nameFallback: ["name"],
    bodyFallback: ["declaration_list", "compound_statement", "enum_declaration_list"],
    boundaryTypes: S("function_definition", "method_declaration", "anonymous_function", "arrow_function"),
    importStyle: "php"
  },
  {
    name: "ruby",
    grammar: "ruby",
    extensions: [".rb"],
    family: "ruby",
    classTypes: S("class", "module"),
    functionTypes: S("method", "singleton_method"),
    importTypes: S(),
    callTypes: S("call"),
    callFunctionField: "method",
    accessorTypes: S(),
    accessorField: "method",
    accessorObjectField: "receiver",
    nameFallback: ["constant", "scope_resolution", "identifier"],
    bodyFallback: ["body_statement"],
    boundaryTypes: S("method", "singleton_method"),
    importStyle: "none"
  },
  {
    name: "swift",
    grammar: "swift",
    extensions: [".swift"],
    family: "swift",
    classTypes: S("class_declaration", "protocol_declaration"),
    functionTypes: S("function_declaration", "protocol_function_declaration", "init_declaration", "deinit_declaration", "subscript_declaration"),
    importTypes: S("import_declaration"),
    callTypes: S("call_expression"),
    callFunctionField: "",
    accessorTypes: S("navigation_expression"),
    accessorField: "",
    accessorObjectField: "target",
    nameFallback: ["simple_identifier", "type_identifier", "user_type"],
    bodyFallback: ["class_body", "protocol_body", "function_body", "enum_class_body"],
    boundaryTypes: S("function_declaration", "protocol_function_declaration", "init_declaration", "deinit_declaration", "subscript_declaration"),
    importStyle: "swift"
  },
  {
    name: "c",
    grammar: "c",
    extensions: [".c", ".h"],
    family: "c",
    classTypes: S(),
    functionTypes: S("function_definition"),
    importTypes: S("preproc_include"),
    callTypes: S("call_expression"),
    callFunctionField: "function",
    accessorTypes: S("field_expression"),
    accessorField: "field",
    accessorObjectField: "argument",
    boundaryTypes: S("function_definition"),
    importStyle: "c"
  },
  {
    name: "cpp",
    grammar: "cpp",
    extensions: [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx", ".cu", ".cuh"],
    family: "c",
    classTypes: S("class_specifier", "struct_specifier"),
    functionTypes: S("function_definition"),
    importTypes: S("preproc_include"),
    callTypes: S("call_expression"),
    callFunctionField: "function",
    accessorTypes: S("field_expression", "qualified_identifier"),
    accessorField: "field",
    accessorObjectField: "argument",
    boundaryTypes: S("function_definition"),
    importStyle: "c"
  },
  {
    name: "lua",
    grammar: "lua",
    extensions: [".lua"],
    family: "lua",
    classTypes: S(),
    functionTypes: S("function_declaration"),
    importTypes: S(),
    callTypes: S("function_call"),
    callFunctionField: "name",
    accessorTypes: S("method_index_expression"),
    accessorField: "name",
    accessorObjectField: "table",
    nameFallback: ["identifier", "method_index_expression"],
    bodyFallback: ["block"],
    boundaryTypes: S("function_declaration"),
    importStyle: "none"
  },
  {
    name: "dart",
    grammar: "dart",
    extensions: [".dart"],
    family: "dart",
    classTypes: S("class_definition", "enum_declaration", "mixin_declaration"),
    functionTypes: S("function_signature", "method_signature"),
    importTypes: S("import_or_export"),
    callTypes: S(),
    callFunctionField: "",
    accessorTypes: S(),
    accessorField: "",
    accessorObjectField: "",
    nameFallback: ["identifier"],
    boundaryTypes: S("function_body"),
    importStyle: "none"
  },
  {
    name: "bash",
    grammar: "bash",
    extensions: [".sh", ".bash"],
    family: "bash",
    classTypes: S(),
    functionTypes: S("function_definition"),
    importTypes: S(),
    callTypes: S("command"),
    callFunctionField: "name",
    accessorTypes: S(),
    accessorField: "",
    accessorObjectField: "",
    boundaryTypes: S("function_definition"),
    importStyle: "none"
  }
];
var byExt = new Map(LANGUAGES.flatMap((l) => l.extensions.map((e) => [e, l])));
function languageForFile(fileName) {
  return byExt.get(path2.extname(fileName).toLowerCase());
}
var BUILTIN_GLOBALS = /* @__PURE__ */ new Set([
  "String",
  "Number",
  "Boolean",
  "Object",
  "Array",
  "Symbol",
  "BigInt",
  "Date",
  "RegExp",
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "Promise",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "JSON",
  "Math",
  "Reflect",
  "Proxy",
  "Intl",
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite",
  "URL",
  "URLSearchParams",
  "FormData",
  "Blob",
  "File",
  "Headers",
  "Request",
  "Response",
  "AbortController",
  "AbortSignal",
  "TextEncoder",
  "TextDecoder",
  "console",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "fetch",
  "require",
  "structuredClone",
  "queueMicrotask",
  "print",
  "len",
  "range",
  "str",
  "int",
  "float",
  "bool",
  "list",
  "dict",
  "set",
  "tuple",
  "isinstance",
  "getattr",
  "setattr",
  "hasattr",
  "super",
  "open",
  "enumerate",
  "zip",
  "map",
  "filter",
  "sorted",
  "min",
  "max",
  "sum",
  "any",
  "all",
  "repr",
  "type",
  "iter",
  "next",
  "format",
  "Exception",
  "ValueError",
  "KeyError"
]);

// engine/src/resolve.ts
var JS_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
function familyOf(rel) {
  const ext = path3.posix.extname(rel).toLowerCase();
  if ([".md", ".mdx", ".qmd"].includes(ext)) return "markdown";
  if (ext === ".json") return "json";
  return languageForFile(rel)?.family ?? "unknown";
}
var isTypeLike = (n) => !!n.source_file && n.file_type === "code" && !n.label.endsWith(")") && !n.label.startsWith(".") && !n.label.includes(".") && n.type !== "namespace";
var isTopFunction = (n) => !!n.source_file && n.label.endsWith(")") && !n.label.startsWith(".") && !n.label.replace(/\(\)$/, "").includes(".");
var alnum = (s) => s.replace(/[^a-zA-Z0-9]+/g, "");
function resolveCorpus(extractions) {
  const byId = /* @__PURE__ */ new Map();
  const renames = /* @__PURE__ */ new Map();
  for (const [rel, ex] of extractions) {
    for (const n of ex.nodes) {
      const prev = byId.get(n.id);
      if (!prev) byId.set(n.id, n);
      else if (!prev.source_file && n.source_file) byId.set(n.id, n);
      else if (prev.source_file && n.source_file && prev.source_file !== n.source_file) {
        const salted = makeId(n.source_file, n.id);
        if (!renames.has(rel)) renames.set(rel, /* @__PURE__ */ new Map());
        renames.get(rel).set(n.id, salted);
        byId.set(salted, { ...n, id: salted });
      }
    }
  }
  let edges = [];
  const rawCalls = [];
  for (const [rel, ex] of extractions) {
    const r = renames.get(rel);
    const fix = (id) => r?.get(id) ?? id;
    for (const e of ex.edges) edges.push(r ? { ...e, source: fix(e.source), target: fix(e.target) } : e);
    for (const c of ex.rawCalls) rawCalls.push(r ? { ...c, caller: fix(c.caller) } : c);
  }
  const bindingsByFile = /* @__PURE__ */ new Map();
  for (const [rel, ex] of extractions) {
    const list = (ex.importBindings ?? []).flatMap((b) => {
      if (b.imported !== "default") return [b];
      const def = extractions.get(b.targetRel)?.defaultExport;
      if (!def) return [];
      edges.push({
        source: fileNodeId(rel),
        target: makeId(fileStem(b.targetRel), def),
        relation: "imports",
        confidence: "EXTRACTED",
        source_file: rel,
        source_location: "L1",
        weight: 1,
        context: "import"
      });
      return [{ ...b, imported: def }];
    });
    bindingsByFile.set(rel, list);
  }
  const nodes = [...byId.values()];
  const typeIndex = /* @__PURE__ */ new Map();
  const fnIndex = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    if (isTypeLike(n)) typeIndex.set(alnum(n.label), [...typeIndex.get(alnum(n.label)) ?? [], n]);
    else if (isTopFunction(n)) fnIndex.set(alnum(bareLabel(n.label)), [...fnIndex.get(alnum(bareLabel(n.label))) ?? [], n]);
  }
  const supertypeTargets = new Set(edges.filter((e) => ["inherits", "implements", "extends"].includes(e.relation)).map((e) => e.target));
  const stubMap = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    if (n.source_file) continue;
    const key = alnum(n.label);
    const types = typeIndex.get(key) ?? [];
    const fns = fnIndex.get(key) ?? [];
    const fam = n.origin_file ? familyOf(n.origin_file) : null;
    if (types.length === 1) stubMap.set(n.id, types[0].id);
    else if (!types.length && fns.length === 1 && !supertypeTargets.has(n.id) && (!fam || familyOf(fns[0].source_file) === fam)) {
      stubMap.set(n.id, fns[0].id);
    }
  }
  if (stubMap.size) {
    edges = edges.map((e) => ({ ...e, source: stubMap.get(e.source) ?? e.source, target: stubMap.get(e.target) ?? e.target }));
    for (const id of stubMap.keys()) byId.delete(id);
  }
  const labelIndex = /* @__PURE__ */ new Map();
  for (const n of byId.values()) {
    if (!n.source_file || n.file_type === "rationale" || n.type === "namespace" || n.file_type === "document") continue;
    const k = bareLabel(n.label);
    labelIndex.set(k, [...labelIndex.get(k) ?? [], n]);
  }
  const importsTo = /* @__PURE__ */ new Map();
  for (const e of edges) {
    if (e.relation !== "imports" && e.relation !== "imports_from") continue;
    if (!importsTo.has(e.source)) importsTo.set(e.source, /* @__PURE__ */ new Set());
    importsTo.get(e.source).add(e.target);
  }
  const existingPairs = new Set(edges.filter((e) => e.relation === "calls" || e.relation === "indirect_call").map((e) => `${e.source}->${e.target}`));
  const callEdge = (c, target, relation, confidence, score) => {
    const key = `${c.caller}->${target}`;
    if (existingPairs.has(key)) return;
    existingPairs.add(key);
    edges.push({
      source: c.caller,
      target,
      relation,
      confidence,
      confidence_score: score,
      source_file: c.sourceFile,
      source_location: `L${c.line}`,
      weight: 1,
      context: c.context ?? "call"
    });
  };
  for (const c of rawCalls) {
    if (c.isMember || BUILTIN_GLOBALS.has(c.callee) || familyOf(c.sourceFile) === "markdown") continue;
    const fileId = fileNodeId(c.sourceFile);
    const fam = familyOf(c.sourceFile);
    const imported = importsTo.get(fileId) ?? /* @__PURE__ */ new Set();
    const binding = bindingsByFile.get(c.sourceFile)?.find((b) => b.local === c.callee);
    let target;
    let evidence = false;
    if (binding) {
      target = byId.get(makeId(fileStem(binding.targetRel), binding.imported));
      evidence = !!target;
    }
    if (!target) {
      const cands = (labelIndex.get(c.callee) ?? []).filter((n) => familyOf(n.source_file) === fam && n.source_file !== c.sourceFile);
      const withEvidence = cands.filter((n) => imported.has(n.id) || imported.has(fileNodeId(n.source_file)));
      if (cands.length === 1) {
        target = cands[0];
        evidence = withEvidence.length === 1;
      } else if (withEvidence.length === 1) {
        target = withEvidence[0];
        evidence = true;
      } else if (cands.length > 1) {
        const nonTest = cands.filter((n) => !/(^|\/)(tests?|__tests__)\/|\.(test|spec)\./.test(n.source_file));
        if (nonTest.length === 1) target = nonTest[0];
      }
    }
    if (!target || !target.source_file) continue;
    if (c.indirect) {
      if (target._callable && !target._callable_class) callEdge(c, target.id, "indirect_call", "INFERRED", 0.85);
      continue;
    }
    if (JS_EXT.test(c.sourceFile) && !evidence) continue;
    callEdge(c, target.id, "calls", evidence ? "EXTRACTED" : "INFERRED", evidence ? 1 : 0.85);
  }
  const methodEdges = new Set(edges.filter((e) => e.relation === "method").map((e) => `${e.source}->${e.target}`));
  const containsTargets = new Set(edges.filter((e) => e.relation === "contains").map((e) => e.target));
  for (const c of rawCalls) {
    if (!c.isMember || !c.receiver || !JS_EXT.test(c.sourceFile)) continue;
    const table = extractions.get(c.sourceFile)?.typeTable ?? {};
    const qualified = /^[A-Z]/.test(c.receiver);
    const typeName = qualified ? c.receiver : table[c.receiver];
    if (!typeName || BUILTIN_GLOBALS.has(typeName)) continue;
    const defs = (typeIndex.get(alnum(typeName)) ?? []).filter((n) => containsTargets.has(n.id) && byId.has(n.id));
    if (defs.length !== 1) continue;
    const def = defs[0];
    const fileId = fileNodeId(c.sourceFile);
    const imported = importsTo.get(fileId) ?? /* @__PURE__ */ new Set();
    const originOk = def.source_file === c.sourceFile || imported.has(def.id) || imported.has(fileNodeId(def.source_file));
    if (!originOk) continue;
    const methodId = makeId(def.id, c.callee);
    if (!byId.has(methodId) || !methodEdges.has(`${def.id}->${methodId}`)) continue;
    callEdge(c, methodId, "calls", qualified ? "EXTRACTED" : "INFERRED", qualified ? 1 : 0.8);
  }
  for (const n of byId.values()) delete n.origin_file;
  return { nodes: [...byId.values()], edges };
}

// engine/src/analyze.ts
var STRUCTURAL = /* @__PURE__ */ new Set(["imports", "imports_from", "contains", "method"]);
var JSON_NOISE = /* @__PURE__ */ new Set([
  "start",
  "end",
  "name",
  "id",
  "type",
  "properties",
  "value",
  "key",
  "data",
  "items",
  "title",
  "description",
  "version",
  "dependencies",
  "devdependencies",
  "peerdependencies",
  "optionaldependencies",
  "bundleddependencies",
  "bundledependencies",
  "scripts",
  "compileroptions"
]);
function isFileNode(g, n) {
  const a = g.getNodeAttributes(n);
  const sf = a.source_file ?? "";
  if (sf && (a.label === path4.posix.basename(sf) || a.label.includes("/") && sf.endsWith(`/${a.label}`) || a.label === sf)) return true;
  if (a.label.startsWith(".") && a.label.endsWith("()")) return true;
  return a.label.endsWith("()") && g.degree(n) <= 1;
}
function isConceptNode(g, n) {
  const sf = g.getNodeAttribute(n, "source_file") ?? "";
  return !sf || !path4.posix.basename(sf).includes(".");
}
function godNodes(g, topN = 10) {
  return g.nodes().filter((n) => {
    if (isFileNode(g, n) || isConceptNode(g, n)) return false;
    const a = g.getNodeAttributes(n);
    return !(a.source_file.endsWith(".json") && JSON_NOISE.has(a.label.toLowerCase()));
  }).sort((a, b) => g.degree(b) - g.degree(a) || a.localeCompare(b)).slice(0, topN).map((id) => ({ id, label: g.getNodeAttribute(id, "label"), degree: g.degree(id) }));
}
var category = (sf) => /\.(md|mdx|qmd|txt|rst)$/.test(sf) ? "doc" : "code";
var topDir = (sf) => sf.includes("/") ? sf.split("/")[0] : "";
function surprisingConnections(g, communities, topN = 5) {
  const cidOf = /* @__PURE__ */ new Map();
  for (const [cid, members] of communities) for (const m of members) cidOf.set(m, cid);
  const scored = [];
  g.forEachEdge((_k, e) => {
    if (STRUCTURAL.has(e.relation)) return;
    const [s, t] = [e._src, e._tgt];
    if ([s, t].some((n) => isConceptNode(g, n) || isFileNode(g, n))) return;
    const sfS = g.getNodeAttribute(s, "source_file");
    const sfT = g.getNodeAttribute(t, "source_file");
    if (!sfS || !sfT || sfS === sfT) return;
    const reasons = [];
    const crossLang = familyOf(sfS) !== familyOf(sfT);
    const weakInferred = e.confidence === "INFERRED" && ["calls", "uses"].includes(e.relation) && (crossLang || category(sfS) !== category(sfT));
    let score = weakInferred ? 0 : { AMBIGUOUS: 3, INFERRED: 2, EXTRACTED: 1 }[e.confidence];
    if (!weakInferred) {
      if (e.confidence !== "EXTRACTED") reasons.push(`rela\xE7\xE3o ${e.confidence.toLowerCase()}`);
      if (category(sfS) !== category(sfT)) score += 2, reasons.push("liga c\xF3digo e documenta\xE7\xE3o");
      if (topDir(sfS) !== topDir(sfT)) score += 2, reasons.push("atravessa pastas de primeiro n\xEDvel");
      if (cidOf.get(s) !== cidOf.get(t)) score += 1, reasons.push("une comunidades diferentes");
      const [d1, d2] = [g.degree(s), g.degree(t)];
      if (Math.min(d1, d2) <= 2 && Math.max(d1, d2) >= 5) score += 1, reasons.push("periferia ligada a um n\xF3 central");
    }
    scored.push({
      source: g.getNodeAttribute(s, "label"),
      target: g.getNodeAttribute(t, "label"),
      sourceFiles: [sfS, sfT],
      confidence: e.confidence,
      relation: e.relation,
      why: reasons.join("; ") || "conex\xE3o entre arquivos",
      score
    });
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}
function importCycles(g, maxLen = 5, topN = 20) {
  const adj = /* @__PURE__ */ new Map();
  g.forEachEdge((_k, e) => {
    if (!["imports_from", "re_exports"].includes(e.relation) || e.type_only || e.deferred) return;
    const from = e.source_file;
    const other = g.getNodeAttribute(e._tgt, "source_file");
    if (!from || !other || from === other) return;
    if (!adj.has(from)) adj.set(from, /* @__PURE__ */ new Set());
    adj.get(from).add(other);
  });
  const found = /* @__PURE__ */ new Map();
  const nodes = [...adj.keys()].sort();
  for (const start2 of nodes) {
    const stack = [[start2, [start2]]];
    while (stack.length && found.size < 200) {
      const [cur, trail] = stack.pop();
      for (const nxt of adj.get(cur) ?? []) {
        if (nxt === start2 && trail.length > 1) {
          const min = trail.reduce((m, x, i2) => x < trail[m] ? i2 : m, 0);
          const canon = [...trail.slice(min), ...trail.slice(0, min)];
          found.set(canon.join(">"), canon);
        } else if (!trail.includes(nxt) && trail.length < maxLen && nxt > start2) {
          stack.push([nxt, [...trail, nxt]]);
        }
      }
    }
  }
  return [...found.values()].sort((a, b) => a.length - b.length || a.join().localeCompare(b.join())).slice(0, topN).map((c) => ({ cycle: [...c, c[0]], length: c.length }));
}
function suggestQuestions(g, communities, names, topN = 7) {
  const qs = [];
  g.forEachEdge((_k, e) => {
    if (e.confidence === "AMBIGUOUS") {
      qs.push({
        type: "ambiguous_edge",
        question: `Qual \xE9 a rela\xE7\xE3o exata entre \`${g.getNodeAttribute(e._src, "label")}\` e \`${g.getNodeAttribute(e._tgt, "label")}\`?`,
        why: "liga\xE7\xE3o marcada como amb\xEDgua"
      });
    }
  });
  const inferredCount = (n) => g.edges(n).filter((k) => g.getEdgeAttribute(k, "confidence") === "INFERRED").length;
  for (const n of g.nodes().filter((n2) => !isFileNode(g, n2) && inferredCount(n2) >= 2).sort((a, b) => g.degree(b) - g.degree(a)).slice(0, 5)) {
    qs.push({
      type: "verify_inferred",
      question: `As ${inferredCount(n)} liga\xE7\xF5es inferidas de \`${g.getNodeAttribute(n, "label")}\` est\xE3o corretas?`,
      why: "rela\xE7\xF5es deduzidas, n\xE3o expl\xEDcitas no c\xF3digo"
    });
  }
  const isolated = g.nodes().filter((n) => g.degree(n) <= 1 && !isFileNode(g, n) && !isConceptNode(g, n) && g.getNodeAttribute(n, "file_type") !== "rationale");
  if (isolated.length) {
    qs.push({
      type: "isolated_nodes",
      question: `O que conecta ${isolated.slice(0, 3).map((n) => `\`${g.getNodeAttribute(n, "label")}\``).join(", ")} ao resto do projeto?`,
      why: `${isolated.length} n\xF3(s) com no m\xE1ximo 1 liga\xE7\xE3o`
    });
  }
  for (const [cid, members] of communities) {
    if (members.length >= 5 && cohesion(g, members) < 0.15) {
      qs.push({ type: "low_cohesion", question: `\`${names.get(cid)}\` deveria ser dividido em partes menores?`, why: "comunidade pouco coesa" });
    }
  }
  return qs.slice(0, topN);
}

// engine/src/build.ts
import path5 from "node:path";
var IMPORT_RELATIONS = /* @__PURE__ */ new Set(["imports", "imports_from", "re_exports"]);
var GENERIC_RELATIONS = /* @__PURE__ */ new Set(["references", "uses", "mentions"]);
var RANK = { EXTRACTED: 3, INFERRED: 2, AMBIGUOUS: 1 };
function buildGraph(nodes, edges) {
  const g = new Graph({ type: "undirected", multi: false, allowSelfLoops: true });
  for (const n of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) if (!g.hasNode(n.id)) g.addNode(n.id, n);
  const sorted = [...edges].sort(
    (a, b) => `${a.source}|${a.target}|${a.relation}`.localeCompare(`${b.source}|${b.target}|${b.relation}`)
  );
  for (const e of sorted) {
    if (!g.hasNode(e.source)) continue;
    if (!g.hasNode(e.target)) {
      if (!IMPORT_RELATIONS.has(e.relation)) continue;
      g.addNode(e.target, {
        id: e.target,
        label: e.target.replace(/^ref_/, ""),
        file_type: "concept",
        source_file: "",
        source_location: "",
        type: "external",
        external: true
      });
    }
    if (e.source === e.target && IMPORT_RELATIONS.has(e.relation)) continue;
    const attrs = {
      ...e,
      confidence_score: e.confidence_score ?? (e.confidence === "EXTRACTED" ? 1 : e.confidence === "INFERRED" ? 0.55 : 0.2),
      _src: e.source,
      _tgt: e.target
    };
    const key = g.edge(e.source, e.target);
    if (!key) {
      g.addEdge(e.source, e.target, attrs);
      continue;
    }
    const cur = g.getEdgeAttributes(key);
    if (cur.relation === e.relation && cur._src !== e.source) continue;
    if (GENERIC_RELATIONS.has(e.relation) && !GENERIC_RELATIONS.has(cur.relation)) continue;
    if (cur.relation === e.relation) {
      if (RANK[e.confidence] < RANK[cur.confidence]) continue;
      if (RANK[e.confidence] === RANK[cur.confidence] && (cur.confidence_score ?? 1) > (attrs.confidence_score ?? 1)) continue;
    }
    g.replaceEdgeAttributes(key, attrs);
  }
  disambiguateFileLabels(g);
  return g;
}
function disambiguateFileLabels(g) {
  const groups = /* @__PURE__ */ new Map();
  g.forEachNode((id, a) => {
    if (a.source_file && a.label === path5.posix.basename(a.source_file)) {
      groups.set(a.label, [...groups.get(a.label) ?? [], id]);
    }
  });
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const paths = ids.map((id) => g.getNodeAttribute(id, "source_file").split("/"));
    ids.forEach((id, i2) => {
      for (let k = 2; k <= paths[i2].length; k++) {
        const suffix = paths[i2].slice(-k).join("/");
        if (paths.filter((p) => p.slice(-k).join("/") === suffix).length === 1) {
          g.setNodeAttribute(id, "label", suffix);
          break;
        }
      }
    });
  }
}

// engine/src/extract-code.ts
import path8 from "node:path";

// engine/src/parser.ts
var import_web_tree_sitter = __toESM(require_tree_sitter(), 1);
import fs2 from "node:fs";
import path6 from "node:path";
var initialized = null;
var languages = /* @__PURE__ */ new Map();
function grammarsDir() {
  if (process.env.FAUNDR_GRAMMARS_DIR) return process.env.FAUNDR_GRAMMARS_DIR;
  const here = path6.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  for (const candidate of [path6.join(here, "..", "grammars"), path6.join(here, "grammars")]) {
    if (fs2.existsSync(path6.join(candidate, "tree-sitter.wasm"))) return candidate;
  }
  throw new Error("Gram\xE1ticas do tree-sitter n\xE3o encontradas (defina FAUNDR_GRAMMARS_DIR)");
}
async function init2() {
  initialized ??= import_web_tree_sitter.default.init({ locateFile: () => path6.join(grammarsDir(), "tree-sitter.wasm") });
  return initialized;
}
async function parse(grammar, source) {
  await init2();
  let lang = languages.get(grammar);
  if (!lang) {
    lang = import_web_tree_sitter.default.Language.load(path6.join(grammarsDir(), `tree-sitter-${grammar}.wasm`));
    languages.set(grammar, lang);
  }
  const parser = new import_web_tree_sitter.default();
  parser.setLanguage(await lang);
  return parser.parse(source.endsWith("\n") ? source : `${source}
`);
}

// engine/src/resolve-paths.ts
import fs3 from "node:fs";
import path7 from "node:path";
var JS_EXTS = [".ts", ".tsx", ".mts", ".cts", ".svelte", ".js", ".jsx", ".mjs", ".cjs"];
var JS_INDEX = ["index.ts", "index.tsx", "index.svelte", "index.js", "index.jsx", "index.mjs"];
function readJsonc(file) {
  try {
    const text = fs3.readFileSync(file, "utf8");
    const clean = text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m) => m.startsWith('"') ? m : "").replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(clean);
  } catch {
    return null;
  }
}
function parsePatterns(map, base) {
  if (!map) return [];
  return Object.entries(map).flatMap(([pattern, value]) => {
    const targets = (Array.isArray(value) ? value : [value]).filter((t) => typeof t === "string");
    const star = pattern.indexOf("*");
    return [
      {
        prefix: star === -1 ? pattern : pattern.slice(0, star),
        suffix: star === -1 ? "" : pattern.slice(star + 1),
        targets: targets.map((t) => path7.posix.join(base, t)),
        exact: star === -1
      }
    ];
  });
}
var PathResolver = class {
  constructor(root) {
    this.root = root;
    const tsconfig = ["tsconfig.json", "jsconfig.json"].map((f) => path7.join(root, f)).find((f) => fs3.existsSync(f));
    this.hasTsconfig = !!tsconfig;
    if (tsconfig) {
      let cfg = readJsonc(tsconfig);
      if (typeof cfg?.extends === "string" && cfg.extends.startsWith(".")) {
        const parent = readJsonc(path7.resolve(path7.dirname(tsconfig), cfg.extends));
        cfg = { ...parent, ...cfg, compilerOptions: { ...parent?.compilerOptions, ...cfg.compilerOptions } };
      }
      const baseUrl = cfg?.compilerOptions?.baseUrl ?? ".";
      this.aliases = parsePatterns(cfg?.compilerOptions?.paths, path7.posix.normalize(baseUrl));
    }
    const pkg = readJsonc(path7.join(root, "package.json"));
    this.pkgImports = parsePatterns(pkg?.imports, ".");
  }
  root;
  aliases = [];
  pkgImports = [];
  hasTsconfig;
  exists(rel) {
    if (rel.startsWith("..")) return null;
    try {
      const st = fs3.statSync(path7.join(this.root, rel));
      return st.isFile() ? "file" : st.isDirectory() ? "dir" : null;
    } catch {
      return null;
    }
  }
  /** Tenta um caminho relativo à raiz com as extensões e index do JS/TS. */
  tryJs(rel) {
    rel = path7.posix.normalize(rel);
    const kind = this.exists(rel);
    if (kind === "file") return rel;
    const swapped = rel.replace(/\.js$/, ".ts").replace(/\.jsx$/, ".tsx").replace(/\.mjs$/, ".mts");
    if (swapped !== rel && this.exists(swapped) === "file") return swapped;
    for (const ext of JS_EXTS) if (this.exists(rel + ext) === "file") return rel + ext;
    if (kind === "dir") {
      for (const idx of JS_INDEX) if (this.exists(`${rel}/${idx}`) === "file") return `${rel}/${idx}`;
    }
    return null;
  }
  viaAliases(raw, aliases) {
    for (const a of aliases) {
      if (a.exact ? raw !== a.prefix : !(raw.startsWith(a.prefix) && raw.endsWith(a.suffix))) continue;
      const middle = a.exact ? "" : raw.slice(a.prefix.length, raw.length - a.suffix.length);
      for (const t of a.targets) {
        const hit = this.tryJs(t.replace("*", middle));
        if (hit) return hit;
      }
    }
    return null;
  }
  /** Retorna o arquivo (relativo à raiz) ou null se for pacote externo. */
  resolveJs(raw, fromRel) {
    if (raw.startsWith(".")) return this.tryJs(path7.posix.join(path7.posix.dirname(fromRel), raw));
    const viaTs = this.viaAliases(raw, this.aliases);
    if (viaTs) return viaTs;
    if (raw.startsWith("#")) {
      const viaPkg = this.viaAliases(raw, this.pkgImports);
      if (viaPkg) return viaPkg;
    }
    if (!this.hasTsconfig && raw.startsWith("@/")) return this.tryJs(`src/${raw.slice(2)}`) ?? this.tryJs(raw.slice(2));
    return null;
  }
  /** Python: `from ..a.b import x` (level = nº de pontos) ou `import a.b`. */
  resolvePython(module2, level, fromRel) {
    const probe = (baseRel) => {
      const rel = path7.posix.normalize(baseRel);
      if (this.exists(`${rel}/__init__.py`) === "file") return `${rel}/__init__.py`;
      if (this.exists(`${rel}.py`) === "file") return `${rel}.py`;
      return null;
    };
    const modPath = module2.replace(/\./g, "/");
    if (level > 0) {
      let base = path7.posix.dirname(fromRel);
      for (let i2 = 1; i2 < level; i2++) base = path7.posix.dirname(base);
      return modPath ? probe(path7.posix.join(base, modPath)) : probe(base);
    }
    for (const prefix of ["", "src/", path7.posix.dirname(fromRel) + "/"]) {
      const hit = probe(prefix + modPath);
      if (hit) return hit;
    }
    return null;
  }
  resolveRelativeFile(raw, fromRel) {
    const rel = path7.posix.normalize(path7.posix.join(path7.posix.dirname(fromRel), raw));
    return this.exists(rel) === "file" ? rel : null;
  }
};
function packageRoot(raw) {
  const parts2 = raw.split("/");
  return raw.startsWith("@") ? parts2.slice(0, 2).join("/") : parts2[0];
}

// engine/src/extract-code.ts
var JS_DESCEND = /* @__PURE__ */ new Set(["arrow_function", "function_expression", "function_declaration", "generator_function_declaration", "generator_function"]);
var JS_FUNCTION_VALUES = /* @__PURE__ */ new Set(["arrow_function", "function_expression", "function", "generator_function"]);
var JS_CONST_VALUES = /* @__PURE__ */ new Set(["object", "array", "as_expression", "satisfies_expression", "call_expression", "new_expression"]);
var RATIONALE = /^(?:\/\/|#)\s*(NOTE|IMPORTANT|HACK|WHY|RATIONALE|TODO|FIXME)\s*:\s*(.+)$/;
var KEEP_PARENT = /* @__PURE__ */ new Set(["decorated_definition", "ERROR", "enum_body_declarations"]);
var line = (n) => n.startPosition.row + 1;
function shorten(text, width = 80) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= width) return flat;
  const cut = flat.slice(0, width - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), width / 2))}\u2026`;
}
async function extractCode(rel, source, cfg, resolver) {
  const tree = await parse(cfg.grammar, source);
  const root = tree.rootNode;
  const stem = fileStem(rel);
  const fileNid = fileNodeId(rel);
  const nodes = [];
  const edges = [];
  const out2 = { nodes, edges, rawCalls: [], importBindings: [] };
  const seen = /* @__PURE__ */ new Set();
  const functionBodies = [];
  const trackedBodies = /* @__PURE__ */ new Set();
  const callable = /* @__PURE__ */ new Set();
  const callableClass = /* @__PURE__ */ new Set();
  const addNode2 = (id, label, n, extra = {}) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    nodes.push({
      id,
      label,
      file_type: "code",
      source_file: rel,
      source_location: `L${typeof n === "number" ? n : line(n)}`,
      ...extra
    });
  };
  const addEdge2 = (source2, target, relation, n, opts = {}) => {
    edges.push({
      source: source2,
      target,
      relation,
      confidence: "EXTRACTED",
      source_file: rel,
      source_location: `L${typeof n === "number" ? n : line(n)}`,
      weight: 1,
      ...opts
    });
  };
  const ensureNamed = (name2) => {
    const local2 = makeId(stem, name2);
    if (seen.has(local2)) return local2;
    const id = makeId(name2);
    if (id && !seen.has(id)) {
      seen.add(id);
      nodes.push({ id, label: name2, file_type: "code", source_file: "", source_location: "", origin_file: rel });
    }
    return id;
  };
  const track = (owner, body2) => {
    if (!body2) return;
    functionBodies.push([owner, body2]);
    trackedBodies.add(body2.id);
  };
  addNode2(fileNid, path8.posix.basename(rel), 1);
  function nameOf(n) {
    const field = cfg.nameFieldByType?.[n.type] ?? cfg.nameField ?? "name";
    let nameNode = n.childForFieldName(field);
    if (!nameNode && cfg.nameFallback) nameNode = n.namedChildren.find((c) => cfg.nameFallback.includes(c.type)) ?? null;
    if (!nameNode && (cfg.name === "c" || cfg.name === "cpp")) {
      let d = n.childForFieldName("declarator");
      while (d && d.childForFieldName("declarator")) d = d.childForFieldName("declarator");
      nameNode = d;
    }
    if (!nameNode) return null;
    const text = nameNode.text.replace(/<[\s\S]*>$/, "").split(/::|\./).pop().trim();
    return normalizeId(text) ? text : null;
  }
  function bodyOf(n) {
    return n.childForFieldName("body") ?? n.namedChildren.find((c) => cfg.bodyFallback?.includes(c.type)) ?? null;
  }
  function importJs(n) {
    const srcNode = n.childForFieldName("source") ?? n.namedChildren.find((c) => c.type === "string");
    if (!srcNode) return false;
    const raw = srcNode.text.replace(/^['"`\s]+|['"`\s]+$/g, "");
    const typeOnly = n.children.some((c) => c.type === "type");
    const targetRel = resolver.resolveJs(raw, rel);
    const reexport = n.type === "export_statement";
    const target = targetRel ? fileNodeId(targetRel) : makeId("ref", packageRoot(raw));
    addEdge2(fileNid, target, "imports_from", n, { context: reexport ? "re-export" : "import", ...typeOnly && { type_only: true } });
    if (!targetRel) return true;
    const targetStem = fileStem(targetRel);
    for (const spec of n.descendantsOfType(reexport ? "export_specifier" : "import_specifier")) {
      const imported = spec.childForFieldName("name")?.text;
      if (!imported || imported === "default") continue;
      const local2 = spec.childForFieldName("alias")?.text ?? imported;
      addEdge2(fileNid, makeId(targetStem, imported), reexport ? "re_exports" : "imports", spec, {
        context: reexport ? "re-export" : "import"
      });
      out2.importBindings.push({ local: local2, imported, targetRel });
    }
    const clause = n.namedChildren.find((c) => c.type === "import_clause");
    const def = clause?.namedChildren.find((c) => c.type === "identifier");
    if (def) out2.importBindings.push({ local: def.text, imported: "default", targetRel });
    return true;
  }
  function importPython(n) {
    if (n.type === "import_statement") {
      for (const d of n.namedChildren) {
        const mod2 = (d.type === "aliased_import" ? d.childForFieldName("name") : d)?.text;
        if (!mod2) continue;
        const targetRel2 = resolver.resolvePython(mod2, 0, rel);
        addEdge2(fileNid, targetRel2 ? fileNodeId(targetRel2) : makeId(mod2), "imports", n, { context: "import" });
      }
      return;
    }
    const modNode = n.childForFieldName("module_name");
    if (!modNode) return;
    const text = modNode.text;
    const level = text.match(/^\.*/)[0].length;
    const mod = text.slice(level);
    const targetRel = resolver.resolvePython(mod, level, rel);
    addEdge2(fileNid, targetRel ? fileNodeId(targetRel) : makeId(mod || text), "imports_from", n, { context: "import" });
    if (!targetRel) return;
    for (const d of n.childrenForFieldName("name")) {
      const imported = (d.type === "aliased_import" ? d.childForFieldName("name") : d)?.text;
      const local2 = d.type === "aliased_import" ? d.childForFieldName("alias")?.text : imported;
      if (!imported || !local2) continue;
      addEdge2(fileNid, makeId(fileStem(targetRel), imported), "imports", d, { context: "import" });
      out2.importBindings.push({ local: local2, imported, targetRel });
    }
  }
  function importOther(n) {
    let raw = "";
    if (cfg.importStyle === "c") {
      const p = n.childForFieldName("path");
      if (!p) return;
      raw = p.text.replace(/^[<"]|[>"]$/g, "");
      const local2 = p.type === "string_literal" ? resolver.resolveRelativeFile(raw, rel) : null;
      addEdge2(fileNid, local2 ? fileNodeId(local2) : makeId("ref", raw), "imports", n, { context: "import" });
      return;
    }
    if (cfg.importStyle === "go") {
      for (const s of n.descendantsOfType("interpreted_string_literal")) {
        addEdge2(fileNid, makeId("ref", s.text.replace(/"/g, "")), "imports", s, { context: "import" });
      }
      return;
    }
    raw = n.text.replace(/^(import|using|use|namespace)\s+(static\s+)?/, "").replace(/[;{].*$/s, "").replace(/\s+as\s+\w+$/, "").trim();
    if (raw) addEdge2(fileNid, makeId("ref", raw), "imports", n, { context: "import" });
  }
  function heritage(n, classNid) {
    const emit = (nameNode, relation) => {
      if (!nameNode) return;
      const name2 = nameNode.text.replace(/<[\s\S]*$/, "").split(".").pop().trim();
      if (normalizeId(name2)) addEdge2(classNid, ensureNamed(name2), relation, nameNode);
    };
    if (cfg.name === "python") {
      for (const a of n.childForFieldName("superclasses")?.namedChildren ?? []) if (a.type === "identifier" || a.type === "attribute") emit(a, "inherits");
      return;
    }
    for (const c of n.namedChildren) {
      if (c.type === "class_heritage") {
        const ext = c.namedChildren.find((x) => x.type === "extends_clause");
        const impl = c.namedChildren.find((x) => x.type === "implements_clause");
        if (!ext && !impl) emit(c.namedChildren[0] ?? null, "inherits");
        if (ext) emit(ext.childForFieldName("value") ?? ext.namedChildren[0] ?? null, "inherits");
        for (const t of impl?.namedChildren ?? []) emit(t, "implements");
      } else if (c.type === "extends_type_clause") {
        for (const t of c.namedChildren) emit(t, "inherits");
      } else if (c.type === "superclass") {
        emit(c.namedChildren[0] ?? null, "inherits");
      } else if (c.type === "super_interfaces") {
        for (const t of c.descendantsOfType("type_identifier")) emit(t, "implements");
      }
    }
  }
  function isModuleLevel(n) {
    const p = n.parent;
    return p?.type === "program" || p?.type === "export_statement" && p.parent?.type === "program";
  }
  function unwrap(v) {
    while ((v.type === "as_expression" || v.type === "satisfies_expression" || v.type === "parenthesized_expression") && v.namedChildren[0]) v = v.namedChildren[0];
    return v;
  }
  function jsExtraWalk(n, parentClass) {
    if (n.type === "lexical_declaration" && isModuleLevel(n)) {
      const exported = n.parent?.type === "export_statement";
      for (const d of n.namedChildren.filter((c) => c.type === "variable_declarator")) {
        const nameNode = d.childForFieldName("name");
        const value = d.childForFieldName("value");
        if (nameNode?.type !== "identifier" || !value) continue;
        const name2 = nameNode.text;
        const nid = makeId(stem, name2);
        const v = unwrap(value);
        if (JS_FUNCTION_VALUES.has(v.type)) {
          addNode2(nid, `${name2}()`, d);
          addEdge2(fileNid, nid, "contains", d);
          callable.add(nid);
          track(nid, v.childForFieldName("body"));
        } else if (JS_CONST_VALUES.has(v.type) || exported) {
          addNode2(nid, name2, d);
          addEdge2(fileNid, nid, "contains", d);
          track(nid, v);
        }
      }
      return true;
    }
    if (n.type === "expression_statement" && n.parent?.type === "program") {
      track(fileNid, n);
      return true;
    }
    if ((n.type === "field_definition" || n.type === "public_field_definition") && parentClass) {
      const value = n.childForFieldName("value");
      const name2 = (n.childForFieldName("name") ?? n.childForFieldName("property"))?.text;
      if (value && name2 && JS_FUNCTION_VALUES.has(unwrap(value).type)) {
        const nid = makeId(parentClass, name2);
        addNode2(nid, `.${name2}()`, n);
        addEdge2(parentClass, nid, "method", n);
        callable.add(nid);
        track(nid, unwrap(value).childForFieldName("body"));
        return true;
      }
    }
    if (n.type === "export_statement") {
      const def = n.children.some((c) => c.type === "default");
      const decl = n.childForFieldName("declaration") ?? n.childForFieldName("value");
      if (def && decl) {
        out2.defaultExport = (decl.type === "identifier" ? decl : decl.childForFieldName("name"))?.text ?? out2.defaultExport;
      }
    }
    return false;
  }
  function walk(n, parentClass) {
    const t = n.type;
    if (cfg.importTypes.has(t)) {
      if (cfg.importStyle === "js") {
        if (importJs(n)) return;
        if (t === "export_statement") {
          jsExtraWalk(n, parentClass);
          for (const c of n.namedChildren) walk(c, parentClass);
          return;
        }
      } else if (cfg.importStyle === "python") {
        importPython(n);
        return;
      } else {
        importOther(n);
        return;
      }
    }
    if (cfg.classTypes.has(t)) {
      const name2 = nameOf(n);
      if (!name2) return;
      const nid = makeId(stem, name2);
      const isNew = !seen.has(nid);
      addNode2(nid, name2, n);
      if (isNew) addEdge2(parentClass ?? fileNid, nid, "contains", n);
      callable.add(nid);
      callableClass.add(nid);
      heritage(n, nid);
      if (t === "enum_declaration" && cfg.js) {
        for (const m of n.descendantsOfType("property_identifier")) {
          const mid = makeId(nid, m.text);
          addNode2(mid, m.text, m);
          addEdge2(mid, nid, "case_of", m);
        }
      }
      const body2 = bodyOf(n);
      if (body2) for (const c of body2.namedChildren) walk(c, nid);
      return;
    }
    if (cfg.functionTypes.has(t)) {
      const name2 = nameOf(n);
      if (!name2) return;
      let owner = parentClass;
      if (cfg.name === "go" && t === "method_declaration") {
        const recv = n.childForFieldName("receiver")?.descendantsOfType("type_identifier")[0]?.text;
        if (recv) owner = makeId(stem, recv);
      }
      if (owner) {
        const nid = makeId(owner, name2);
        addNode2(nid, `.${name2}()`, n);
        addEdge2(seen.has(owner) ? owner : fileNid, nid, seen.has(owner) ? "method" : "contains", n);
        callable.add(nid);
        track(nid, bodyOf(n));
      } else {
        const nid = makeId(stem, name2);
        addNode2(nid, `${name2}()`, n);
        addEdge2(fileNid, nid, "contains", n);
        callable.add(nid);
        track(nid, bodyOf(n));
      }
      return;
    }
    if (cfg.js && jsExtraWalk(n, parentClass)) return;
    const keep = KEEP_PARENT.has(t);
    for (const c of n.namedChildren) walk(c, keep ? parentClass : null);
  }
  walk(root, null);
  for (const c of root.descendantsOfType("comment")) {
    const m = c.text.trim().match(RATIONALE);
    if (!m) continue;
    const rid = makeId(stem, "rationale", String(line(c)));
    addNode2(rid, shorten(`${m[1]}: ${m[2]}`), c, { file_type: "rationale" });
    addEdge2(rid, fileNid, "rationale_for", c);
  }
  const labelToNid = /* @__PURE__ */ new Map();
  for (const nd of nodes) if (nd.source_file && nd.id !== fileNid) labelToNid.set(bareLabel(nd.label), nd.id);
  const callPairs = /* @__PURE__ */ new Set();
  const indirectPairs = /* @__PURE__ */ new Set();
  function calleeOf(n) {
    if (n.type === "jsx_opening_element" || n.type === "jsx_self_closing_element") {
      const nm = n.childForFieldName("name");
      if (nm?.type !== "identifier" || /^[a-z]/.test(nm.text)) return null;
      return { name: nm.text, member: false };
    }
    let fn2 = n.type === "new_expression" ? n.childForFieldName("constructor") : cfg.name === "java" && n.type === "object_creation_expression" ? n.childForFieldName("type") : cfg.callFunctionField ? n.childForFieldName(cfg.callFunctionField) : n.namedChildren[0];
    if (!fn2) return null;
    if (cfg.name === "java" && n.type === "method_invocation") {
      const obj = n.childForFieldName("object");
      return { name: fn2.text, member: !!obj, receiver: obj?.text };
    }
    if (fn2.type === "identifier" || fn2.type === "type_identifier" || fn2.type === "simple_identifier" || fn2.type === "name") {
      return { name: fn2.text, member: false };
    }
    if (cfg.accessorTypes.has(fn2.type)) {
      const prop = cfg.accessorField ? fn2.childForFieldName(cfg.accessorField) : fn2.namedChildren[fn2.namedChildCount - 1];
      const obj = cfg.accessorObjectField ? fn2.childForFieldName(cfg.accessorObjectField) : fn2.namedChildren[0];
      const name2 = (prop ?? fn2.namedChildren[fn2.namedChildCount - 1])?.text.replace(/^\./, "");
      if (!name2) return null;
      if (obj?.type === "member_expression" && obj.childForFieldName("object")?.type === "this") {
        return { name: name2, member: true, receiver: obj.childForFieldName("property")?.text, thisField: true };
      }
      if (fn2.type === "scoped_identifier" || fn2.type === "qualified_identifier") {
        const path15 = fn2.childForFieldName("path") ?? fn2.childForFieldName("scope");
        return { name: name2, member: true, receiver: path15?.text };
      }
      return { name: name2, member: true, receiver: obj?.type === "identifier" || obj?.type === "this" || obj?.type === "self" ? obj.text : obj?.text.slice(0, 40) };
    }
    return null;
  }
  function localsOf(body2) {
    const names = /* @__PURE__ */ new Set();
    const params = body2.parent?.childForFieldName("parameters") ?? body2.parent?.childForFieldName("parameter");
    for (const id of params?.descendantsOfType(["identifier", "shorthand_property_identifier_pattern"]) ?? []) names.add(id.text);
    for (const d of body2.descendantsOfType(["variable_declarator"])) {
      const nm = d.childForFieldName("name");
      if (nm) for (const id of nm.type === "identifier" ? [nm] : nm.descendantsOfType(["identifier", "shorthand_property_identifier_pattern"])) names.add(id.text);
    }
    return names;
  }
  function emitIndirect(caller, name2, n, context, locals) {
    if (locals.has(name2) || name2 === "self" || name2 === "cls" || BUILTIN_GLOBALS.has(name2)) return;
    const tgt = labelToNid.get(name2);
    if (tgt) {
      if (tgt === caller || !callable.has(tgt) || callableClass.has(tgt)) return;
      const key = `${caller}->${tgt}`;
      if (callPairs.has(key) || indirectPairs.has(key)) return;
      indirectPairs.add(key);
      addEdge2(caller, tgt, "indirect_call", n, { confidence: "INFERRED", confidence_score: 0.85, context });
    } else if (/^[A-Za-z_$][\w$]*$/.test(name2)) {
      out2.rawCalls.push({ caller, callee: name2, isMember: false, sourceFile: rel, line: line(n), indirect: true, context });
    }
  }
  function walkCalls(n, caller, locals, isRoot) {
    if (!isRoot && cfg.boundaryTypes.has(n.type)) {
      const body2 = n.childForFieldName("body");
      if (!(cfg.js && JS_DESCEND.has(n.type) && body2 && !trackedBodies.has(body2.id))) return;
      locals = /* @__PURE__ */ new Set([...locals, ...localsOf(body2)]);
    }
    if (cfg.callTypes.has(n.type)) {
      const fnNode = n.childForFieldName("function");
      if (cfg.js && fnNode?.type === "import") {
        const arg = n.childForFieldName("arguments")?.namedChildren[0];
        if (arg?.type === "string") {
          const raw = arg.text.replace(/^['"`]|['"`]$/g, "");
          const targetRel = resolver.resolveJs(raw, rel);
          addEdge2(caller, targetRel ? fileNodeId(targetRel) : makeId("ref", packageRoot(raw)), "imports_from", n, {
            context: "import",
            deferred: true
          });
        }
      } else {
        const c = calleeOf(n);
        if (c && !(!c.member && BUILTIN_GLOBALS.has(c.name))) {
          const pyForeign = cfg.name === "python" && c.member && !["self", "cls", "super"].includes(c.receiver ?? "");
          const defer = c.member && BUILTIN_GLOBALS.has(c.receiver ?? "") || c.member && (/^[A-Z]/.test(c.receiver ?? "") || !!c.thisField) || pyForeign || c.member && ["java", "csharp"].includes(cfg.name);
          const tgt = defer ? void 0 : labelToNid.get(c.name);
          if (tgt) {
            const key = `${caller}->${tgt}`;
            if (!callPairs.has(key)) {
              callPairs.add(key);
              addEdge2(caller, tgt, "calls", n, { context: "call" });
            }
          } else if (!(cfg.name === "python" && !c.member && locals.has(c.name))) {
            out2.rawCalls.push({ caller, callee: c.name, isMember: c.member, receiver: c.receiver, sourceFile: rel, line: line(n) });
          }
        }
        if (cfg.js || cfg.name === "python") {
          for (const a of n.childForFieldName("arguments")?.namedChildren ?? []) {
            if (a.type === "identifier") emitIndirect(caller, a.text, a, "argument", locals);
          }
        }
      }
    }
    if (cfg.js && (n.type === "pair" || n.type === "shorthand_property_identifier")) {
      const v = n.type === "pair" ? n.childForFieldName("value") : n;
      if (v && (v.type === "identifier" || v.type === "shorthand_property_identifier")) emitIndirect(caller, v.text, v, "collection", locals);
    }
    for (const c of n.namedChildren) walkCalls(c, caller, locals, false);
  }
  for (const [caller, body2] of functionBodies) walkCalls(body2, caller, localsOf(body2), true);
  if (cfg.js) {
    const table = {};
    for (const d of root.descendantsOfType("variable_declarator")) {
      const nm = d.childForFieldName("name");
      const v = d.childForFieldName("value");
      const ctor = v?.type === "new_expression" ? v.childForFieldName("constructor") : null;
      if (nm?.type === "identifier" && ctor?.type === "identifier") table[nm.text] ??= ctor.text;
    }
    for (const p of root.descendantsOfType(["required_parameter", "optional_parameter"])) {
      const nm = p.childForFieldName("pattern");
      const ty = p.childForFieldName("type")?.namedChildren[0];
      if (nm?.type === "identifier" && ty?.type === "type_identifier") table[nm.text] ??= ty.text;
    }
    out2.typeTable = table;
  }
  for (const nd of nodes) {
    if (callable.has(nd.id)) nd._callable = true;
    if (callableClass.has(nd.id)) nd._callable_class = true;
  }
  const local = new Set(nodes.map((nd) => nd.id));
  const dedupe = /* @__PURE__ */ new Set();
  out2.edges = edges.filter((e) => {
    if (!local.has(e.source)) return false;
    if (!local.has(e.target) && !["imports", "imports_from", "re_exports"].includes(e.relation)) return false;
    const key = JSON.stringify(e);
    if (dedupe.has(key)) return false;
    dedupe.add(key);
    return true;
  });
  tree.delete();
  return out2;
}

// engine/src/extract-docs.ts
import fs4 from "node:fs";
import path9 from "node:path";
var INLINE_LINK = /(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+[^)]*)?\)/g;
var REF_DEF = /^\s{0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/;
var WIKILINK = /(?<!!)\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
var DOC_EXTS = /* @__PURE__ */ new Set([".md", ".mdx", ".qmd", ".markdown", ".rst", ".txt"]);
function edge(source, target, relation, rel, ln, extra = {}) {
  return { source, target, relation, confidence: "EXTRACTED", source_file: rel, source_location: `L${ln}`, weight: 1, ...extra };
}
function resolveLink(raw, rel, root, wiki, allDocs) {
  let target = raw.replace(/[#?].*$/, "");
  if (!target || /:\/\//.test(target) || /^(mailto:|tel:|\/\/|data:)/.test(target)) return null;
  try {
    target = decodeURIComponent(target);
  } catch {
  }
  if (!path9.posix.extname(target)) target += ".md";
  if (!DOC_EXTS.has(path9.posix.extname(target).toLowerCase())) return null;
  const candidate = path9.posix.normalize(path9.posix.join(path9.posix.dirname(rel), target));
  if (!candidate.startsWith("..") && fs4.existsSync(path9.join(root, candidate))) return candidate;
  if (wiki) {
    const base = path9.posix.basename(target).toLowerCase();
    const hits = allDocs.filter((d) => d.toLowerCase().endsWith(`/${base}`) || d.toLowerCase() === base);
    hits.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
    return hits[0] ?? null;
  }
  return null;
}
function extractMarkdown(rel, source, root, allDocs) {
  const stem = fileStem(rel);
  const fileNid = fileNodeId(rel);
  const nodes = [
    { id: fileNid, label: path9.posix.basename(rel), file_type: "document", source_file: rel, source_location: "L1", node_kind: "page" }
  ];
  const edges = [];
  const seen = /* @__PURE__ */ new Set([fileNid]);
  const linked = /* @__PURE__ */ new Set();
  const stack = [];
  const lines = source.split(/\r?\n/);
  let fmEnd = -1;
  if (lines[0]?.trim() === "---") {
    for (let i2 = 1; i2 < Math.min(lines.length, 200); i2++) {
      if (lines[i2].trim() === "---" || lines[i2].trim() === "...") {
        fmEnd = i2;
        break;
      }
    }
  }
  const link = (raw, ln, wiki) => {
    const target = resolveLink(raw, rel, root, wiki, allDocs);
    if (!target || target === rel || linked.has(target)) return;
    linked.add(target);
    edges.push(edge(fileNid, fileNodeId(target), "references", rel, ln));
  };
  let inFence = false;
  lines.forEach((text, i2) => {
    const ln = i2 + 1;
    const stripped = text.trim();
    if (stripped.startsWith("```")) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const h = i2 > fmEnd ? text.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/) : null;
    if (h) {
      const level = h[1].length;
      const title = h[2].trim();
      let id = makeId(stem, title);
      if (!normalizeId(title)) return;
      if (seen.has(id)) id = makeId(stem, title, String(ln));
      seen.add(id);
      nodes.push({ id, label: title, file_type: "document", source_file: rel, source_location: `L${ln}`, node_kind: "heading" });
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      edges.push(edge(stack.length ? stack[stack.length - 1].id : fileNid, id, "contains", rel, ln));
      stack.push({ level, id });
    }
    for (const m of text.matchAll(INLINE_LINK)) link(m[1], ln, false);
    const ref = text.match(REF_DEF);
    if (ref) link(ref[1], ln, false);
    for (const m of text.matchAll(WIKILINK)) link(m[1].trim(), ln, true);
  });
  return { nodes, edges, rawCalls: [] };
}
var CONFIG_NAMES = /* @__PURE__ */ new Set([
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  "composer.json",
  "deno.json",
  "deno.jsonc",
  "bower.json",
  "manifest.json",
  "app.json",
  "now.json",
  "vercel.json",
  "angular.json",
  "nest-cli.json",
  "biome.json",
  "renovate.json",
  ".babelrc",
  ".babelrc.json",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.json",
  "babel.config.json",
  "wrangler.json",
  "components.json"
]);
var CONFIG_KEYS = /* @__PURE__ */ new Set([
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "bundleDependencies",
  "bundledDependencies",
  "extends",
  "$ref",
  "$schema",
  "compilerOptions"
]);
var DEP_KEYS = /* @__PURE__ */ new Set(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]);
function extractJson(rel, source) {
  const name2 = path9.posix.basename(rel);
  if (source.length > 1024 * 1024) return null;
  let data;
  try {
    data = JSON.parse(source.replace(/^﻿/, ""));
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const isConfig = CONFIG_NAMES.has(name2) || /tsconfig.*\.json$/.test(name2) || Object.keys(data).some((k) => CONFIG_KEYS.has(k));
  if (!isConfig) return null;
  const stem = fileStem(rel);
  const fileNid = fileNodeId(rel);
  const nodes = [{ id: fileNid, label: name2, file_type: "code", source_file: rel, source_location: "L1" }];
  const edges = [];
  const seen = /* @__PURE__ */ new Set([fileNid]);
  let pairs = 0;
  const addRef = (dep) => {
    const id = makeId("ref", dep);
    if (!seen.has(id)) {
      seen.add(id);
      nodes.push({ id, label: dep, file_type: "concept", source_file: "", source_location: "" });
    }
    return id;
  };
  const walk = (obj, parentId, parentKey, depth) => {
    if (depth > 6) return;
    for (const [key, value] of Object.entries(obj)) {
      if (++pairs > 500) return;
      if (parentKey && DEP_KEYS.has(parentKey) && typeof value === "string") {
        edges.push(edge(fileNid, addRef(key), "imports", rel, 1, { context: "import" }));
        continue;
      }
      if (key === "extends" && typeof value === "string") {
        edges.push(edge(fileNid, addRef(value), "extends", rel, 1, { context: "import" }));
        continue;
      }
      const id = makeId(stem, parentKey ?? void 0, key);
      if (!normalizeId(key) || seen.has(id)) continue;
      seen.add(id);
      nodes.push({ id, label: key, file_type: "code", source_file: rel, source_location: "L1" });
      edges.push(edge(parentId, id, "contains", rel, 1));
      if (value && typeof value === "object" && !Array.isArray(value)) walk(value, id, key, depth + 1);
    }
  };
  walk(data, fileNid, null, 0);
  return { nodes, edges, rawCalls: [] };
}

// engine/src/files.ts
var import_ignore = __toESM(require_ignore(), 1);
import fs5 from "node:fs";
import path10 from "node:path";
var SKIP_DIRS = /* @__PURE__ */ new Set([
  "venv",
  ".venv",
  "node_modules",
  "__pycache__",
  ".git",
  "dist",
  "build",
  "target",
  "site-packages",
  "lib64",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".tox",
  ".nox",
  ".eggs",
  "graphify-out",
  "lcov-report",
  "visual-tests",
  "visual-test",
  "__snapshots__",
  "storybook-static",
  "dist-protected",
  ".next",
  ".nuxt",
  ".turbo",
  ".angular",
  ".idea",
  ".cache",
  ".parcel-cache",
  ".svelte-kit",
  ".terraform",
  ".serverless",
  ".graphify",
  ".obsidian",
  ".smart-env",
  ".worktrees",
  ".faundr",
  ".wrangler",
  ".output",
  ".vinxi",
  ".tanstack",
  ".nitro"
]);
var SKIP_FILES = /* @__PURE__ */ new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
  "go.sum",
  "go.work.sum",
  "bun.lockb"
]);
var IGNORE_FILES = [".gitignore", ".faundrignore"];
var MARKDOWN_EXT = /* @__PURE__ */ new Set([".md", ".mdx", ".qmd"]);
var MAX_FILE_BYTES = 2 * 1024 * 1024;
function isSkippedDir(name2) {
  return SKIP_DIRS.has(name2) || name2.endsWith(".egg-info") || name2.endsWith("_venv");
}
function isSensitive(rel) {
  const parts2 = rel.split("/");
  const name2 = parts2[parts2.length - 1];
  if (parts2.some((p) => [".ssh", ".gnupg", ".aws", ".gcloud"].includes(p))) return true;
  if (/^\.env(\..+)?$/.test(name2) && !/\.(example|sample|template|dist)$/.test(name2)) return true;
  if (/^\.dev\.vars/.test(name2) && !name2.endsWith(".example")) return true;
  if (/\.(pem|key|p12|pfx|cert|crt|der|p8)$/i.test(name2)) return true;
  if (/^id_(rsa|dsa|ecdsa|ed25519)/.test(name2)) return true;
  return [".netrc", ".npmrc", ".pypirc", ".git-credentials", ".boto", ".pgpass", ".htpasswd"].includes(name2);
}
function loadRules(dirAbs, dirRel) {
  const ig = (0, import_ignore.default)();
  let any = false;
  for (const f of IGNORE_FILES) {
    try {
      ig.add(fs5.readFileSync(path10.join(dirAbs, f), "utf8"));
      any = true;
    } catch {
    }
  }
  return any ? { anchor: dirRel, ig } : null;
}
function ignored(rel, isDir, rules) {
  let result = false;
  for (const { anchor, ig } of rules) {
    const sub = anchor ? rel.slice(anchor.length + 1) : rel;
    if (!sub) continue;
    const r = ig.test(isDir ? `${sub}/` : sub);
    if (r.ignored) result = true;
    else if (r.unignored) result = false;
  }
  return result;
}
function collectFiles(root) {
  const out2 = [];
  function walk(dirAbs, dirRel, inherited) {
    const own = loadRules(dirAbs, dirRel);
    const rules = own ? [...inherited, own] : inherited;
    let entries;
    try {
      entries = fs5.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = dirRel ? `${dirRel}/${e.name}` : e.name;
      const abs = path10.join(dirAbs, e.name);
      if (e.isDirectory()) {
        if (isSkippedDir(e.name) || ignored(rel, true, rules)) continue;
        walk(abs, rel, rules);
        continue;
      }
      if (!e.isFile() || SKIP_FILES.has(e.name) || isSensitive(rel) || ignored(rel, false, rules)) continue;
      try {
        if (fs5.statSync(abs).size > MAX_FILE_BYTES) continue;
      } catch {
        continue;
      }
      const ext = path10.extname(e.name).toLowerCase();
      if (MARKDOWN_EXT.has(ext)) out2.push({ rel, abs, kind: "markdown" });
      else if (ext === ".json") out2.push({ rel, abs, kind: "json" });
      else {
        const lang = languageForFile(e.name);
        if (lang) out2.push({ rel, abs, kind: "code", grammar: lang.grammar });
      }
    }
  }
  walk(root, "", []);
  return out2;
}

// engine/src/report.ts
import path11 from "node:path";
var MIN_COMMUNITY = 3;
function renderReport(opts) {
  const { g, communities, names } = opts;
  const L = [];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const real = (members) => members.filter((m) => !isFileNode(g, m));
  let ext = 0;
  let inf = 0;
  let amb = 0;
  let infScore = 0;
  g.forEachEdge((_k, e) => {
    if (e.confidence === "EXTRACTED") ext++;
    else if (e.confidence === "INFERRED") inf++, infScore += e.confidence_score ?? 0.5;
    else amb++;
  });
  const total = g.size || 1;
  const pct = (n) => Math.round(n / total * 100);
  const thin = [...communities.values()].filter((m) => real(m).length < MIN_COMMUNITY).length;
  L.push(`# Relat\xF3rio do grafo - ${path11.basename(opts.root)}  (${today})`, "");
  L.push("## Corpus", `- ${opts.totalFiles} arquivos \xB7 ~${opts.totalWords.toLocaleString("pt-BR")} palavras`, "");
  L.push(
    "## Resumo",
    `- ${g.order} n\xF3s \xB7 ${g.size} liga\xE7\xF5es \xB7 ${communities.size} comunidades${thin ? ` (${communities.size - thin} exibidas, ${thin} pequenas omitidas)` : ""}`,
    `- Extra\xE7\xE3o: ${pct(ext)}% EXTRA\xCDDA \xB7 ${pct(inf)}% INFERIDA \xB7 ${pct(amb)}% AMB\xCDGUA${inf ? ` \xB7 INFERIDAS: ${inf} liga\xE7\xF5es (confian\xE7a m\xE9dia: ${(infScore / inf).toFixed(2)})` : ""}`,
    "- Custo de IA: 0 (an\xE1lise est\xE1tica local)",
    ""
  );
  if (opts.commit) {
    L.push("## Atualidade", `- Gerado a partir do commit \`${opts.commit.slice(0, 8)}\``, "- Rode `faundr graph` depois de mudan\xE7as no c\xF3digo (sem custo).", "");
  }
  L.push("## Comunidades (navega\xE7\xE3o)");
  for (const [cid, members] of communities) if (real(members).length >= 1) L.push(`- ${names.get(cid)}`);
  L.push("");
  L.push("## N\xF3s centrais (as abstra\xE7\xF5es que tudo atravessa)");
  opts.gods.forEach((n, i2) => L.push(`${i2 + 1}. \`${n.label}\` - ${n.degree} liga\xE7\xF5es`));
  L.push("");
  L.push("## Conex\xF5es surpreendentes");
  if (!opts.surprises.length) L.push("- Nenhuma: todas as conex\xF5es ficam dentro dos mesmos arquivos.");
  for (const s of opts.surprises) {
    L.push(`- \`${s.source}\` --${s.relation}--> \`${s.target}\`  [${s.confidence}]`, `  ${s.sourceFiles[0]} \u2192 ${s.sourceFiles[1]}  _${s.why}_`);
  }
  L.push("");
  L.push("## Ciclos de import");
  if (!opts.cycles.length) L.push("- Nenhum.");
  for (const c of opts.cycles) L.push(`- ciclo de ${c.length} arquivos: \`${c.cycle.join(" -> ")}\``);
  L.push("");
  L.push(`## Comunidades (${communities.size} no total${thin ? `, ${thin} pequenas omitidas` : ""})`, "");
  for (const [cid, members] of communities) {
    const r = real(members);
    if (r.length < MIN_COMMUNITY) continue;
    const labels = r.map((m) => g.getNodeAttribute(m, "label"));
    L.push(
      `### Comunidade ${cid} - "${names.get(cid)}"`,
      `Coes\xE3o: ${cohesion(g, members).toFixed(2)}`,
      `N\xF3s (${r.length}): ${labels.slice(0, 8).join(", ")}${r.length > 8 ? ` (+${r.length - 8})` : ""}`,
      ""
    );
  }
  const isolated = g.nodes().filter((n) => g.degree(n) <= 1 && !isFileNode(g, n) && !isConceptNode(g, n) && g.getNodeAttribute(n, "file_type") !== "rationale");
  if (isolated.length || thin) {
    L.push("## Lacunas");
    if (isolated.length) {
      L.push(
        `- **${isolated.length} n\xF3(s) isolado(s):** ${isolated.slice(0, 5).map((n) => `\`${g.getNodeAttribute(n, "label")}\``).join(", ")}${isolated.length > 5 ? ` (+${isolated.length - 5})` : ""}`,
        "  T\xEAm no m\xE1ximo 1 liga\xE7\xE3o: poss\xEDveis liga\xE7\xF5es faltando ou componentes sem uso."
      );
    }
    if (thin) L.push(`- **${thin} comunidades pequenas (<${MIN_COMMUNITY} n\xF3s) omitidas** \u2014 use \`faundr graph-query\` para explor\xE1-las.`);
    L.push("");
  }
  L.push("## Perguntas sugeridas", "_Perguntas que este grafo responde bem:_", "");
  for (const q of opts.questions) L.push(`- **${q.question}**`, `  _${q.why}_`);
  return L.join("\n") + "\n";
}

// engine/src/roles.ts
import path12 from "node:path";
var dir = (re) => new RegExp(`(^|/)(${re})/`, "i");
function roleForFile(rel) {
  const ext = path12.posix.extname(rel).toLowerCase();
  const base = path12.posix.basename(rel).toLowerCase();
  if ([".md", ".mdx", ".qmd"].includes(ext)) return "document";
  if (/\.(test|spec)\.[^.]+$/.test(base) || dir("tests?|__tests__|e2e|cypress|playwright").test(rel)) return "test";
  if (ext === ".json" || /^(vite|vitest|tailwind|postcss|eslint|prettier|next|nuxt|astro|svelte|webpack|rollup|babel|jest|drizzle|playwright)\.config\./.test(
    base
  ) || /^(tsconfig|jsconfig|wrangler)/.test(base)) {
    return "config";
  }
  if (ext === ".sql" || dir("migrations|prisma|schema|models|db|database|supabase").test(rel)) return "database";
  if (dir("api").test(rel)) return "api";
  if (dir("routes|pages|app|screens|views").test(rel)) return "screen";
  if (dir("components|ui|widgets").test(rel)) return "component";
  if (dir("server|backend|functions|handlers|controllers|services|workers").test(rel)) return "server";
  if (dir("lib|utils|helpers|shared|hooks|common").test(rel)) return "helper";
  if (dir("plugin|plugins|bin|cli|scripts|extensions").test(rel)) return "tool";
  return "logic";
}
function roleForNode(n) {
  if (n.file_type === "rationale") return "decision";
  if (!n.source_file) return "external";
  return roleForFile(n.source_file);
}
function humanize(name2) {
  const spaced = name2.replace(/\.[^.]+$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : name2;
}
function routePath(rel) {
  const m = rel.match(/(?:^|\/)(?:routes|pages|app)\/(.+)$/);
  if (!m) return null;
  const parts2 = m[1].replace(/\.[^.]+$/, "").split("/").filter((p) => p !== "index" && !/^(page|route)$/.test(p)).map((p) => p.replace(/^\$(.+)/, ":$1").replace(/^\[(.+)\]$/, ":$1"));
  return `/${parts2.join("/")}`;
}
function displayLabel(rel, role, docTitle) {
  const base = path12.posix.basename(rel);
  if (role === "document") {
    if (docTitle) return docTitle;
    const parent = path12.posix.basename(path12.posix.dirname(rel));
    if (/^skill.md$/i.test(base) && parent) return `Comando ${humanize(parent)}`;
    if (/^(readme|index).mdx?$/i.test(base) && parent && parent !== ".") return humanize(parent);
    return humanize(base);
  }
  if (role === "screen" || role === "api") {
    if (/__root\./.test(base)) return "Estrutura base das p\xE1ginas";
    const route = routePath(rel);
    if (route) return role === "api" ? `API ${route}` : route === "/" ? "P\xE1gina inicial" : `P\xE1gina ${route}`;
  }
  if (role === "database") return `Banco: ${humanize(base.replace(/^\d+[_-]/, ""))}`;
  return humanize(base);
}

// engine/src/pipeline.ts
var OUT_DIR = ".faundr";
function gitCommit(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || void 0;
  } catch {
    return void 0;
  }
}
async function buildProjectGraph(root) {
  const started = Date.now();
  const files = collectFiles(root);
  const resolver = new PathResolver(root);
  const docs = files.filter((f) => f.kind === "markdown").map((f) => f.rel);
  const extractions = /* @__PURE__ */ new Map();
  let words = 0;
  for (const f of files) {
    let source;
    try {
      source = fs6.readFileSync(f.abs, "utf8");
    } catch {
      continue;
    }
    words += source.split(/\s+/).length;
    try {
      if (f.kind === "markdown") extractions.set(f.rel, extractMarkdown(f.rel, source, root, docs));
      else if (f.kind === "json") {
        const ex = extractJson(f.rel, source);
        if (ex) extractions.set(f.rel, ex);
      } else {
        const lang = languageForFile(f.rel);
        extractions.set(f.rel, await extractCode(f.rel, source, lang, resolver));
      }
    } catch (err2) {
      process.stderr.write(`faundr graph: falha ao ler ${f.rel}: ${err2.message}
`);
    }
  }
  const { nodes, edges } = resolveCorpus(extractions);
  const g = buildGraph(nodes, edges);
  const communities = cluster(g);
  const names = nameCommunities(g, communities);
  const commit = gitCommit(root);
  const report = renderReport({
    root,
    g,
    communities,
    names,
    gods: godNodes(g),
    surprises: surprisingConnections(g, communities),
    cycles: importCycles(g),
    questions: suggestQuestions(g, communities, names),
    totalFiles: files.length,
    totalWords: words,
    commit
  });
  const graph = toGraphJson(g, communities, names, commit);
  return {
    graph,
    report,
    stats: { files: files.length, nodes: g.order, edges: g.size, communities: communities.size, ms: Date.now() - started }
  };
}
var sortKeys = (o, first) => Object.fromEntries([...first.filter((k) => k in o).map((k) => [k, o[k]]), ...Object.keys(o).filter((k) => !first.includes(k)).sort().map((k) => [k, o[k]])]);
function toGraphJson(g, communities, names, commit) {
  const cidOf = /* @__PURE__ */ new Map();
  for (const [cid, members] of communities) for (const m of members) cidOf.set(m, cid);
  const docTitle = /* @__PURE__ */ new Map();
  g.forEachNode((_id, a) => {
    if (a.node_kind !== "heading") return;
    const line2 = Number(a.source_location.slice(1));
    const cur = docTitle.get(a.source_file);
    if (!cur || line2 < cur.line) docTitle.set(a.source_file, { line: line2, title: a.label });
  });
  const nodes = g.mapNodes((id, a) => {
    const cid = cidOf.get(id) ?? null;
    const role = roleForNode(a);
    const isFile = !!a.source_file && id === fileNodeId(a.source_file);
    return sortKeys(
      {
        ...a,
        community: cid,
        community_name: cid === null ? "" : names.get(cid),
        norm_label: normLabel(a.label),
        role,
        ...isFile && { display_label: displayLabel(a.source_file, role, docTitle.get(a.source_file)?.title) },
        _origin: "ast"
      },
      ["id", "label"]
    );
  });
  const links = g.mapEdges((_k, e) => {
    const { _src, _tgt, ...rest } = e;
    return sortKeys({ ...rest, source: _src, target: _tgt }, ["source", "target", "relation"]);
  });
  const byJson = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
  return {
    directed: false,
    multigraph: false,
    graph: {},
    nodes: nodes.sort(byJson),
    links: links.sort(byJson),
    hyperedges: [],
    ...commit && { built_at_commit: commit }
  };
}
function writeOutputs(root, result) {
  const dir2 = path13.join(root, OUT_DIR);
  fs6.mkdirSync(dir2, { recursive: true });
  fs6.writeFileSync(path13.join(dir2, "graph.json"), JSON.stringify(result.graph));
  fs6.writeFileSync(path13.join(dir2, "GRAPH_REPORT.md"), result.report);
}
function loadGraphJson(root) {
  const file = path13.join(root, OUT_DIR, "graph.json");
  if (!fs6.existsSync(file)) throw new Error("Grafo ainda n\xE3o gerado. Rode: faundr graph");
  return JSON.parse(fs6.readFileSync(file, "utf8"));
}

// engine/src/query.ts
var STOPWORDS = new Set(
  "the and for with that this what where when which who how why does into from about are was were been have has had can could should would will not but all any our your their there here then than them they its also just only work works working onde como qual quais quem quando porque para por com que uma umas uns dos das nos nas pelo pela isso isto esse essa este esta ele ela eles elas seu sua seus suas tem ter foi ser sao s\xE3o est\xE1 esta est\xE3o fazer faz vai v\xE3o vao fica ficam pra pro sobre entre cada todo toda todos todas depois antes agora ainda muito mais menos quero preciso existe existem acontece funciona onde aqui ali l\xE1 tipo coisa coisas der die das und mit von les des une pour avec dans los las del por con una para the".split(/\s+/)
);
var RELATIONAL = /^(call(s|ed)?|caller(s)?|invoke\w*|use\w*|import\w*|export\w*|extend\w*|implement\w*|depend(s)?|reference\w*|chama\w*|usa\w*|importa\w*)$/;
var strip = (s) => s.normalize("NFKD").replace(new RegExp("\\p{M}+", "gu"), "");
var tokens = (s) => strip(s).toLowerCase().match(/[^\W_]+/gu) ?? [];
function loadGraph(json) {
  const g = new Graph({ type: "undirected", multi: false, allowSelfLoops: true });
  for (const n of json.nodes) g.addNode(n.id, n);
  for (const l of json.links) {
    if (!g.hasNode(l.source) || !g.hasNode(l.target) || g.hasEdge(l.source, l.target)) continue;
    g.addEdge(l.source, l.target, { ...l, _src: l.source, _tgt: l.target });
  }
  return g;
}
function queryTerms(q) {
  const all = q.split(/\s+/).flatMap((w) => w.toLowerCase().match(/\w+/gu) ?? []).filter((t) => /[^\x00-\x7f]/.test(t) || /^[a-z]+$/.test(t) && t.length > 2);
  const kept = all.filter((t) => !STOPWORDS.has(t));
  return kept.length ? kept : all;
}
function scoreNodes(g, terms) {
  const norm = [...new Set(terms.flatMap(tokens))];
  const N = g.order;
  const labelOf = (id) => g.getNodeAttribute(id, "norm_label") ?? strip(g.getNodeAttribute(id, "label")).toLowerCase();
  const idf = new Map(norm.map((t) => [t, Math.log(1 + N / (1 + g.filterNodes((id) => labelOf(id).includes(t)).length))]));
  const joined = norm.join(" ");
  const joinedW = Math.max(0, ...idf.values());
  const scores = [];
  g.forEachNode((id, a) => {
    const nl = labelOf(id);
    const bare = nl.replace(/\(\)$/, "");
    const lt = tokens(a.label).join(" ");
    const src = (a.source_file ?? "").toLowerCase();
    let score = 0;
    if ([nl, bare, lt, id.toLowerCase()].includes(joined)) score += 1e3 * 10 * joinedW;
    else if (joined && [nl, bare, lt].some((x) => x.startsWith(joined))) score += 100 * 10 * joinedW;
    let tiered = 0;
    let matched = 0;
    for (const t of norm) {
      const w = idf.get(t);
      if (t === nl || t === bare) tiered += 1e3 * w, matched++;
      else if (nl.startsWith(t) || bare.startsWith(t) || lt.split(" ").some((x) => x.startsWith(t))) tiered += 100 * w, matched++;
      else if (nl.includes(t)) tiered += w, matched++;
      if (src.includes(t)) score += 0.5 * w;
    }
    if (norm.length) score += tiered * (matched / norm.length) ** 2;
    if (score > 0) scores.push({ id, score });
  });
  const label = (id) => g.getNodeAttribute(id, "label");
  return scores.sort((a, b) => b.score - a.score || label(a.id).length - label(b.id).length || a.id.localeCompare(b.id));
}
function pickSeeds(g, ranked, terms) {
  const seeds = [];
  const labels = /* @__PURE__ */ new Set();
  const add = (id) => {
    const l = (g.getNodeAttribute(id, "norm_label") ?? g.getNodeAttribute(id, "label")).toLowerCase();
    if (labels.has(l)) return;
    labels.add(l);
    seeds.push(id);
  };
  const top = ranked[0]?.score ?? 0;
  for (const r of ranked) {
    if (seeds.length >= 3 || seeds.length && r.score < top * 0.2) break;
    add(r.id);
  }
  const hasOthers = terms.some((t) => !RELATIONAL.test(t));
  for (const t of [...new Set(terms)].sort()) {
    if (hasOthers && RELATIONAL.test(t)) continue;
    const best = scoreNodes(g, [t])[0];
    if (best) add(best.id);
  }
  return seeds;
}
function describeNode(g, id) {
  const a = g.getNodeAttributes(id);
  return `NODE ${a.label} [src=${a.source_file || "-"} loc=${a.source_location || "-"} community=${a.community_name || a.community}]`;
}
function describeEdge(g, key) {
  const e = g.getEdgeAttributes(key);
  const ctx = e.context ? ` context=${e.context}` : "";
  const at = e.source_file ? ` at=${e.source_file}:${e.source_location}` : "";
  return `EDGE ${g.getNodeAttribute(e._src, "label")} --${e.relation} [${e.confidence}${ctx}]--> ${g.getNodeAttribute(e._tgt, "label")}${at}`;
}
function query(json, question, opts = {}) {
  const g = loadGraph(json);
  const budget = opts.budget ?? 2e3;
  const depth = opts.depth ?? 2;
  const terms = queryTerms(question);
  const seeds = pickSeeds(g, scoreNodes(g, terms), terms);
  if (!seeds.length) return "Nenhum n\xF3 encontrado para essa pergunta.";
  const degrees = g.nodes().map((n) => g.degree(n)).sort((a, b) => a - b);
  const hub = Math.max(50, degrees[Math.floor(degrees.length * 0.99)] ?? 0);
  const dist = new Map(seeds.map((s) => [s, 0]));
  let frontier = [...seeds];
  for (let d = 1; d <= depth; d++) {
    const next = [];
    for (const n of frontier) {
      if (!seeds.includes(n) && g.degree(n) >= hub) continue;
      for (const nb of g.neighbors(n)) {
        if (!dist.has(nb)) {
          dist.set(nb, d);
          next.push(nb);
        }
      }
    }
    frontier = opts.dfs ? next.slice(0, 1) : next;
  }
  const visited = [...dist.keys()];
  const order = [
    ...seeds,
    ...visited.filter((n) => !seeds.includes(n)).sort((a, b) => dist.get(a) - dist.get(b) || g.degree(b) - g.degree(a) || a.localeCompare(b))
  ];
  const set = new Set(visited);
  const edgeLines = g.edges().filter((k) => set.has(g.source(k)) && set.has(g.target(k)) && g.source(k) !== g.target(k)).sort().map((k) => describeEdge(g, k));
  const header = `Grafo: ${g.order} n\xF3s | Travessia: ${opts.dfs ? "DFS" : "BFS"} profundidade=${depth} | In\xEDcio: [${seeds.map((s) => g.getNodeAttribute(s, "label")).join(", ")}] | ${visited.length} n\xF3s encontrados

`;
  const maxChars = budget * 3;
  const nodeLines = order.map((n) => describeNode(g, n));
  let body2 = [...nodeLines, ...edgeLines].join("\n");
  if (body2.length > maxChars) {
    const seedBlock = nodeLines.slice(0, seeds.length).join("\n");
    let cut = body2.slice(0, Math.max(maxChars, seedBlock.length));
    cut = cut.slice(0, Math.max(cut.lastIndexOf("\n"), seedBlock.length));
    const shown = cut.split("\n").filter((l) => l.startsWith("NODE ")).length;
    const hidden = order.length - shown;
    if (hidden > 0) {
      return `[!] TRUNCADO: mostrando ${shown} de ${order.length} n\xF3s (~${budget} tokens). A resposta pode estar nos ${hidden} n\xF3s cortados \u2014 aumente --budget ou refine a pergunta.

` + header + cut + `
... (mais ${hidden} n\xF3s cortados pelo limite de ~${budget} tokens)`;
    }
    body2 = cut;
  }
  return header + body2;
}
function findNode(g, text) {
  let scope;
  let name2 = text;
  if (text.includes("::")) [scope, name2] = text.split("::", 2);
  const term = tokens(name2).join(" ");
  const nq = strip(name2).toLowerCase().trim();
  const cands = g.filterNodes((_id, a) => !scope || (a.source_file ?? "").endsWith(scope));
  const tiers = [
    (id) => tokens(g.getNodeAttribute(id, "source_file") ?? "").join(" ") === term && g.getNodeAttribute(id, "label") === (g.getNodeAttribute(id, "source_file") ?? "").split("/").pop(),
    (id) => {
      const a = g.getNodeAttributes(id);
      const nl = (a.norm_label ?? a.label.toLowerCase()).replace(/\(\)$/, "");
      return [a.norm_label, nl, tokens(a.label).join(" "), id].some((x) => x === term || x === nq);
    },
    (id) => (g.getNodeAttribute(id, "norm_label") ?? "").startsWith(nq),
    (id) => (g.getNodeAttribute(id, "norm_label") ?? "").includes(nq)
  ];
  for (const tier of tiers) {
    const hits = cands.filter(tier);
    if (!hits.length) continue;
    const files = new Set(hits.map((h) => g.getNodeAttribute(h, "source_file")));
    if (files.size > 1 && hits.length > 1) {
      const sorted = hits.sort((a, b) => g.degree(b) - g.degree(a));
      return { ambiguous: sorted };
    }
    return { id: hits.sort((a, b) => g.degree(b) - g.degree(a))[0] };
  }
  return {};
}
function explain(json, text) {
  const g = loadGraph(json);
  const { id, ambiguous } = findNode(g, text);
  if (ambiguous) {
    return [
      `Amb\xEDguo: '${text}' corresponde a ${ambiguous.length} n\xF3s em arquivos diferentes.`,
      ...ambiguous.slice(0, 10).map((n) => `  ${g.getNodeAttribute(n, "source_file")}
    id: ${n}`),
      `Tente de novo com caminho::s\xEDmbolo, ex.: ${g.getNodeAttribute(ambiguous[0], "source_file")}::${text}`
    ].join("\n");
  }
  if (!id) return `Nenhum n\xF3 encontrado para '${text}'.`;
  const a = g.getNodeAttributes(id);
  const conns = g.edges(id).map((k) => {
    const e = g.getEdgeAttributes(k);
    const other = g.opposite(id, k);
    const out2 = e._src === id;
    return { other, out: out2, e };
  }).sort((x, y) => g.degree(y.other) - g.degree(x.other));
  const lines = [
    `N\xF3: ${a.label}`,
    `  ID:         ${id}`,
    `  Fonte:      ${a.source_file || "-"} ${a.source_location || ""}`,
    `  Tipo:       ${a.file_type}`,
    `  Comunidade: ${a.community_name || a.community}`,
    `  Grau:       ${g.degree(id)}`,
    "",
    `Conex\xF5es (${conns.length}):`,
    ...conns.slice(0, 20).map(
      ({ other, out: out2, e }) => `  ${out2 ? "-->" : "<--"} ${g.getNodeAttribute(other, "label")} [${e.relation}] [${e.confidence}] ${g.getNodeAttribute(other, "source_file") || ""}${g.getNodeAttribute(other, "source_location") ? `:${g.getNodeAttribute(other, "source_location")}` : ""}`
    )
  ];
  if (conns.length > 20) lines.push(`  ... e mais ${conns.length - 20}`);
  const byFile = /* @__PURE__ */ new Map();
  for (const c of conns) {
    const f = g.getNodeAttribute(c.other, "source_file") || "(externo)";
    byFile.set(f, (byFile.get(f) ?? 0) + 1);
  }
  lines.push("  Por arquivo:", ...[...byFile].sort((x, y) => y[1] - x[1]).map(([f, n]) => `    ${f}: ${n} conex\xF5es`));
  return lines.join("\n");
}
function shortestPath(json, from, to, opts = {}) {
  const g = loadGraph(json);
  const a = findNode(g, from);
  const b = findNode(g, to);
  const src = a.id ?? a.ambiguous?.[0];
  const dst = b.id ?? b.ambiguous?.[0];
  if (!src) return `Nenhum n\xF3 encontrado para '${from}'.`;
  if (!dst) return `Nenhum n\xF3 encontrado para '${to}'.`;
  if (src === dst) return `'${from}' e '${to}' apontam para o mesmo n\xF3.`;
  const prev = /* @__PURE__ */ new Map([[src, { node: "", key: "" }]]);
  const queue = [src];
  while (queue.length && !prev.has(dst)) {
    const cur2 = queue.shift();
    for (const k of g.edges(cur2).sort()) {
      const e = g.getEdgeAttributes(k);
      const nb = g.opposite(cur2, k);
      if (!opts.undirected && e._src !== cur2) continue;
      if (!prev.has(nb)) {
        prev.set(nb, { node: cur2, key: k });
        queue.push(nb);
      }
    }
  }
  if (!prev.has(dst)) {
    return `Nenhum caminho direcionado entre '${from}' e '${to}'. Rode de novo com --undirected para ignorar a dire\xE7\xE3o.`;
  }
  const hops = [];
  for (let n = dst; n !== src; n = prev.get(n).node) hops.unshift({ node: n, key: prev.get(n).key });
  let line2 = `  ${g.getNodeAttribute(src, "label")}`;
  let cur = src;
  for (const h of hops) {
    const e = g.getEdgeAttributes(h.key);
    line2 += e._src === cur ? ` --${e.relation} [${e.confidence}]--> ` : ` <--${e.relation} [${e.confidence}]-- `;
    line2 += g.getNodeAttribute(h.node, "label");
    cur = h.node;
  }
  return `Caminho mais curto (${hops.length} saltos):
${line2}`;
}

// engine/src/quality.ts
var GRAMMAR = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript"
};
var FUNCTIONS = /* @__PURE__ */ new Set([
  "function_declaration",
  "function_expression",
  "function",
  "generator_function_declaration",
  "generator_function",
  "arrow_function",
  "method_definition"
]);
var BRANCHES = /* @__PURE__ */ new Set([
  "if_statement",
  "for_statement",
  "for_in_statement",
  "while_statement",
  "do_statement",
  "catch_clause",
  "ternary_expression"
]);
var NESTING = /* @__PURE__ */ new Set(["if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement", "switch_statement", "try_statement"]);
var MOCK_IMPORT = /(^|\/)(__mocks__|mocks?|fixtures?|fakes?|stubs?)(\/|$)|[./-](mock|fake|stub)s?(\.[jt]sx?)?$/i;
var LIMITS = { complexity: 20, complexityHigh: 40, functionLines: 150, nesting: 4, nonNull: 10 };
function qualityGrammar(rel) {
  const ext = rel.slice(rel.lastIndexOf(".")).toLowerCase();
  return GRAMMAR[ext] ?? null;
}
async function analyzeQuality(rel, source, { test = false } = {}) {
  const grammar = qualityGrammar(rel);
  const module2 = { imports: [], exports: [], commonjs: false };
  if (!grammar) return { hits: [], functions: [], module: module2 };
  const tree = await parse(grammar, source);
  const hits = [];
  const functions = [];
  const add = (rule, node, ctx) => hits.push({ rule, line: node.startPosition.row + 1, ctx });
  let nonNull = 0;
  const visit = (node) => {
    const t = node.type;
    if (test) {
      if (t === "call_expression") testCall(node, add);
    } else {
      if (t === "catch_clause") catchClause(node, add);
      else if (t === "call_expression") call(node, add);
      else if (t === "debugger_statement") add("limpeza/debugger", node);
      else if (t === "predefined_type" && node.text === "any") {
        add(node.parent?.type === "as_expression" ? "tipos/as-any" : "tipos/any", node);
      } else if (t === "non_null_expression") nonNull++;
      else if (t === "ternary_expression" && !isTernaryChild(node) && hasNestedTernary(node)) add("complexidade/ternario-aninhado", node);
      else if (t === "import_statement") {
        const from = node.childForFieldName("source")?.text.slice(1, -1) ?? "";
        if (MOCK_IMPORT.test(from)) add("falha/mock-em-producao", node, { from });
      }
      if (FUNCTIONS.has(t)) fn(node, add, functions);
    }
    if (t === "comment") comment(node, add);
    if (t === "import_statement" || t === "export_statement") moduleEdge(node, module2);
    else if (t === "call_expression") dynamicImport(node, module2);
    else if (t === "member_expression" && /^(module\.exports|exports\.\w+)$/.test(node.text)) module2.commonjs = true;
    for (const child of node.namedChildren) visit(child);
  };
  visit(tree.rootNode);
  if (nonNull >= LIMITS.nonNull) hits.push({ rule: "tipos/non-null-em-excesso", line: 1, ctx: { count: nonNull } });
  commentedCode(tree.rootNode, source.split("\n"), hits);
  tree.delete();
  return { hits, functions, module: module2 };
}
var statements = (block) => (block?.namedChildren ?? []).filter((n) => n.type !== "comment");
var hasComment = (block) => (block?.namedChildren ?? []).some((n) => n.type === "comment");
var isConsoleCall = (n) => n.type === "expression_statement" && n.namedChildren[0]?.type === "call_expression" && /^console\.\w+$/.test(n.namedChildren[0].childForFieldName("function")?.text ?? "");
var isEmptyValue = (n) => !n || ["null", "undefined", "false"].includes(n.type) || n.text === "undefined" || /^(\[\s*\]|\{\s*\})$/.test(n.text);
function catchClause(node, add) {
  const body2 = node.childForFieldName("body");
  const list = statements(body2);
  if (!list.length) return hasComment(body2) ? void 0 : add("falha/catch-vazio", node);
  if (list.every(isConsoleCall)) return add("falha/catch-so-loga", node);
  if (list.length === 1 && list[0].type === "return_statement" && isEmptyValue(list[0].namedChildren[0]) && !hasComment(body2))
    add("falha/catch-devolve-nulo", node);
}
function call(node, add) {
  const callee = node.childForFieldName("function");
  if (!callee) return;
  if (callee.type === "member_expression" && callee.childForFieldName("property")?.text === "catch") {
    const handler = node.childForFieldName("arguments")?.namedChildren[0];
    if (handler && (handler.type === "arrow_function" || handler.type === "function_expression" || handler.type === "function")) {
      const body2 = handler.childForFieldName("body");
      if (body2?.type === "statement_block") {
        if (!statements(body2).length && !hasComment(body2)) add("falha/catch-vazio", node);
      } else if (isEmptyValue(body2)) add("falha/catch-devolve-nulo", node);
    }
  }
  if (/^console\.(log|debug)$/.test(callee.text)) add("limpeza/console-log", node);
}
var CHECKS = /\b(expect|assert)\b|\.should\b|\bt\.(is|true|false|deepEqual|throws)\b|toMatch(Inline)?Snapshot/;
function testCall(node, add) {
  const callee = node.childForFieldName("function")?.text ?? "";
  if (/(^|\.)waitForTimeout$/.test(callee) || callee === "setTimeout" && /^\d+$/.test(node.childForFieldName("arguments")?.namedChildren[1]?.text ?? ""))
    add("testes/espera-fixa", node, { call: callee });
  const m = callee.match(/^(it|test|describe|context)\.(skip|only|todo)$/) ?? callee.match(/^(x|f)(it|describe|test)$/);
  if (m) {
    const only = m[2] === "only" || m[1] === "f";
    add(only ? "testes/only" : "testes/pulado", node, { call: callee });
    return;
  }
  if (!/^(it|test)(\.(concurrent|serial))?$/.test(callee)) return;
  const args2 = node.childForFieldName("arguments")?.namedChildren ?? [];
  const body2 = args2.find((a) => FUNCTIONS.has(a.type));
  const name2 = args2[0]?.type === "string" || args2[0]?.type === "template_string" ? args2[0].text.slice(1, -1) : callee;
  if (body2 && !CHECKS.test(body2.text)) add("testes/sem-conferencia", node, { name: name2.slice(0, 80) });
}
var isTernaryChild = (node) => {
  let p = node.parent;
  while (p?.type === "parenthesized_expression") p = p.parent;
  return p?.type === "ternary_expression";
};
var hasNestedTernary = (node) => ["condition", "consequence", "alternative"].some((f) => {
  let c = node.childForFieldName(f);
  while (c?.type === "parenthesized_expression") c = c.namedChildren[0];
  return c?.type === "ternary_expression";
});
function functionName(node) {
  const own = node.childForFieldName("name")?.text;
  if (own) return own;
  const p = node.parent;
  if (p?.type === "variable_declarator") return p.childForFieldName("name")?.text ?? "(an\xF4nima)";
  if (p?.type === "pair") return p.childForFieldName("key")?.text ?? "(an\xF4nima)";
  if (p?.type === "assignment_expression") return p.childForFieldName("left")?.text ?? "(an\xF4nima)";
  const holder = p?.type === "arguments" ? p.parent?.parent : null;
  if (holder?.type === "variable_declarator") return holder.childForFieldName("name")?.text ?? "(an\xF4nima)";
  return "(an\xF4nima)";
}
function fn(node, add, functions) {
  const body2 = node.childForFieldName("body");
  if (!body2) return;
  let complexity = 1;
  let deepest = { depth: 0, node: body2 };
  const walk = (n, depth) => {
    for (const c of n.namedChildren) {
      if (FUNCTIONS.has(c.type)) continue;
      let d = depth;
      if (BRANCHES.has(c.type)) complexity++;
      else if (c.type === "switch_case") complexity++;
      else if (c.type === "binary_expression" && /^(&&|\|\|)$/.test(c.childForFieldName("operator")?.text ?? "")) complexity++;
      if (NESTING.has(c.type) && !(c.type === "if_statement" && c.parent?.type === "else_clause")) {
        d = depth + 1;
        if (d > deepest.depth) deepest = { depth: d, node: c };
      }
      walk(c, d);
    }
  };
  walk(body2, 0);
  const name2 = functionName(node);
  const lines = node.endPosition.row - node.startPosition.row + 1;
  functions.push({ name: name2, line: node.startPosition.row + 1, complexity, lines });
  if (complexity > LIMITS.complexity) add("complexidade/funcao", node, { name: name2, complexity });
  if (lines > LIMITS.functionLines) add("complexidade/funcao-longa", node, { name: name2, lines });
  if (deepest.depth > LIMITS.nesting) add("complexidade/aninhamento", deepest.node, { name: name2, depth: deepest.depth });
}
function comment(node, add) {
  const text = node.text;
  const ts = text.match(/@ts-(ignore|nocheck|expect-error)\b(.*)/);
  if (ts && !/[a-zà-ú]{3,}/i.test(ts[2].replace(/\*\/\s*$/, ""))) add("tipos/ts-ignore-sem-motivo", node, { directive: `@ts-${ts[1]}` });
  const es = text.match(/eslint-disable(-next-line|-line)?\b(.*)/);
  if (es && !/--\s*\S/.test(es[2])) add("tipos/eslint-disable-sem-motivo", node);
}
var CODE_LINE = /[;{}]\s*$|^\s*(const|let|var|if|for|while|return|import|export|function|await|async|try|catch|switch|case|throw|class)\b|^\s*[\w.$\]]+\s*\(.*\)\s*;?\s*$|^\s*[\w.$]+\s*=[^=]|^\s*<\/?[A-Za-z][\w.]*[\s>/]/;
function commentedCode(root, lines, hits) {
  let run2 = null;
  let lastRow = -2;
  const flush = () => {
    if (run2 && run2.code >= 4 && run2.code / run2.total >= 0.75) hits.push({ rule: "demais/codigo-comentado", line: run2.start + 1, ctx: { lines: run2.total } });
    run2 = null;
  };
  const visit = (n) => {
    for (const c of n.namedChildren) {
      const row = c.startPosition.row;
      const alone = !(lines[row] ?? "").slice(0, c.startPosition.column).trim();
      if (c.type === "comment" && alone && c.text.startsWith("//") && !c.text.startsWith("///")) {
        if (row !== lastRow + 1) flush();
        run2 ??= { start: row, code: 0, total: 0 };
        run2.total++;
        const body2 = c.text.slice(2);
        if (CODE_LINE.test(body2) && !/faundr-ignore|eslint|@ts-|prettier-ignore/.test(body2)) run2.code++;
        lastRow = row;
      } else visit(c);
    }
  };
  visit(root);
  flush();
}
var unquote = (n) => n ? n.text.slice(1, -1) : "";
var exportedName = (spec) => (spec.childForFieldName("alias") ?? spec.childForFieldName("name"))?.text ?? "";
function moduleEdge(node, m) {
  const source = node.childForFieldName("source");
  if (node.type === "import_statement") {
    const names = [];
    for (const part of node.namedChildren.find((c) => c.type === "import_clause")?.namedChildren ?? []) {
      if (part.type === "identifier") names.push("default");
      else if (part.type === "namespace_import") names.push("*");
      else if (part.type === "named_imports") {
        for (const spec of part.namedChildren) if (spec.type === "import_specifier") names.push(spec.childForFieldName("name")?.text ?? "");
      }
    }
    m.imports.push({ spec: unquote(source), names });
    return;
  }
  const line2 = node.startPosition.row + 1;
  const specs = node.namedChildren.find((c) => c.type === "export_clause")?.namedChildren.filter((c) => c.type === "export_specifier");
  if (source) {
    m.imports.push({ spec: unquote(source), names: specs ? specs.map((c) => c.childForFieldName("name")?.text ?? "") : ["*"] });
    for (const c of specs ?? []) m.exports.push({ name: exportedName(c), line: line2 });
    return;
  }
  if (/^export\s+default\b/.test(node.text)) return void m.exports.push({ name: "default", line: line2 });
  if (specs) return void specs.forEach((c) => m.exports.push({ name: exportedName(c), line: line2 }));
  const decl = node.childForFieldName("declaration");
  const own = decl?.childForFieldName("name");
  if (own) return void m.exports.push({ name: own.text, line: line2 });
  for (const d of decl?.namedChildren ?? []) {
    const name2 = d.type === "variable_declarator" ? d.childForFieldName("name") : null;
    if (name2?.type === "identifier") m.exports.push({ name: name2.text, line: line2 });
  }
}
function dynamicImport(node, m) {
  const callee = node.childForFieldName("function");
  if (callee?.type !== "import" && callee?.text !== "require") return;
  const arg = node.childForFieldName("arguments")?.namedChildren[0];
  if (arg?.type === "string") m.imports.push({ spec: unquote(arg), names: ["*"] });
}
function unusedCode(root, modules, texts, entry) {
  const resolver = new PathResolver(root);
  const importedBy = /* @__PURE__ */ new Map();
  const usedNames = /* @__PURE__ */ new Map();
  for (const [rel, m] of modules)
    for (const imp of m.imports) {
      const target = resolver.resolveJs(imp.spec, rel);
      if (!target || target === rel) continue;
      importedBy.set(target, (importedBy.get(target) ?? 0) + 1);
      const used = usedNames.get(target) ?? /* @__PURE__ */ new Set();
      imp.names.forEach((n) => used.add(n));
      usedNames.set(target, used);
    }
  const others = (rel) => [...texts].filter(([r]) => r !== rel).map(([, t]) => t);
  const mentioned = (rel) => {
    const base = rel.slice(rel.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
    return base.length < 3 || others(rel).some((t) => t.includes(base));
  };
  const orphans = [];
  const exports2 = [];
  for (const [rel, m] of modules) {
    if (entry(rel)) continue;
    if (!importedBy.get(rel)) {
      if (!mentioned(rel)) orphans.push(rel);
      continue;
    }
    const used = usedNames.get(rel) ?? /* @__PURE__ */ new Set();
    if (used.has("*") || m.commonjs) continue;
    const own = texts.get(rel) ?? "";
    for (const e of m.exports) {
      if (!e.name || used.has(e.name)) continue;
      if (e.name !== "default" && (own.match(new RegExp(`\\b${e.name.replace(/\$/g, "\\$")}\\b`, "g"))?.length ?? 0) > 1) continue;
      exports2.push({ file: rel, name: e.name, line: e.line });
    }
  }
  return { orphans, exports: exports2 };
}

// engine/src/cli.ts
function flag(args2, name2) {
  const i2 = args2.indexOf(name2);
  return i2 >= 0 ? args2[i2 + 1] : void 0;
}
async function runEngine(args2, root = process.cwd()) {
  const [cmd, ...rest] = args2;
  const positional = rest.filter((a, i2) => !a.startsWith("--") && !(i2 > 0 && ["--budget"].includes(rest[i2 - 1])));
  switch (cmd) {
    case "build": {
      const dir2 = path14.resolve(positional[0] ?? root);
      const result = await buildProjectGraph(dir2);
      writeOutputs(dir2, result);
      const s = result.stats;
      return `Grafo gerado: ${s.nodes} n\xF3s, ${s.edges} liga\xE7\xF5es, ${s.communities} comunidades a partir de ${s.files} arquivos (${(s.ms / 1e3).toFixed(1)} s).`;
    }
    case "query":
      return query(loadGraphJson(root), positional.join(" "), { budget: Number(flag(rest, "--budget") ?? 2e3), dfs: rest.includes("--dfs") });
    case "path":
      if (positional.length < 2) throw new Error('uso: path "A" "B" [--undirected]');
      return shortestPath(loadGraphJson(root), positional[0], positional[1], { undirected: rest.includes("--undirected") });
    case "explain":
      return explain(loadGraphJson(root), positional.join(" "));
    default:
      return 'comandos: build [raiz] | query "<pergunta>" [--budget N] [--dfs] | path "A" "B" [--undirected] | explain "X"';
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runEngine(process.argv.slice(2)).then((out2) => console.log(out2)).catch((err2) => {
    console.error(err2.message);
    process.exit(1);
  });
}
export {
  analyzeQuality,
  buildProjectGraph,
  explain,
  loadGraphJson,
  qualityGrammar,
  query,
  runEngine,
  shortestPath,
  unusedCode,
  writeOutputs
};
