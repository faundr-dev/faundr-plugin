import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __f2p } from 'node:url'; import { dirname as __dn } from 'node:path'; const require = __cr(import.meta.url); const __filename = __f2p(import.meta.url); const __dirname = __dn(__filename);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
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
  "node_modules/graphology-utils/defaults.js"(exports, module2) {
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
  "node_modules/graphology-utils/is-graph.js"(exports, module2) {
    module2.exports = function isGraph(value) {
      return value !== null && typeof value === "object" && typeof value.addUndirectedEdgeWithKey === "function" && typeof value.dropNode === "function" && typeof value.multi === "boolean";
    };
  }
});

// node_modules/graphology-utils/infer-type.js
var require_infer_type = __commonJS({
  "node_modules/graphology-utils/infer-type.js"(exports, module2) {
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
  "node_modules/obliterator/iterator.js"(exports, module2) {
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
  "node_modules/mnemonist/utils/typed-arrays.js"(exports) {
    var MAX_8BIT_INTEGER = Math.pow(2, 8) - 1;
    var MAX_16BIT_INTEGER = Math.pow(2, 16) - 1;
    var MAX_32BIT_INTEGER = Math.pow(2, 32) - 1;
    var MAX_SIGNED_8BIT_INTEGER = Math.pow(2, 7) - 1;
    var MAX_SIGNED_16BIT_INTEGER = Math.pow(2, 15) - 1;
    var MAX_SIGNED_32BIT_INTEGER = Math.pow(2, 31) - 1;
    exports.getPointerArray = function(size) {
      var maxIndex = size - 1;
      if (maxIndex <= MAX_8BIT_INTEGER)
        return Uint8Array;
      if (maxIndex <= MAX_16BIT_INTEGER)
        return Uint16Array;
      if (maxIndex <= MAX_32BIT_INTEGER)
        return Uint32Array;
      throw new Error("mnemonist: Pointer Array of size > 4294967295 is not supported.");
    };
    exports.getSignedPointerArray = function(size) {
      var maxIndex = size - 1;
      if (maxIndex <= MAX_SIGNED_8BIT_INTEGER)
        return Int8Array;
      if (maxIndex <= MAX_SIGNED_16BIT_INTEGER)
        return Int16Array;
      if (maxIndex <= MAX_SIGNED_32BIT_INTEGER)
        return Int32Array;
      return Float64Array;
    };
    exports.getNumberType = function(value) {
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
    exports.getMinimalRepresentation = function(array, getter) {
      var maxType = null, maxPriority = 0, p, t, v, i2, l;
      for (i2 = 0, l = array.length; i2 < l; i2++) {
        v = getter ? getter(array[i2]) : array[i2];
        t = exports.getNumberType(v);
        p = TYPE_PRIORITY[t.name];
        if (p > maxPriority) {
          maxPriority = p;
          maxType = t;
        }
      }
      return maxType;
    };
    exports.isTypedArray = function(value) {
      return typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value);
    };
    exports.concat = function() {
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
    exports.indices = function(length) {
      var PointerArray = exports.getPointerArray(length);
      var array = new PointerArray(length);
      for (var i2 = 0; i2 < length; i2++)
        array[i2] = i2;
      return array;
    };
  }
});

// node_modules/mnemonist/sparse-map.js
var require_sparse_map = __commonJS({
  "node_modules/mnemonist/sparse-map.js"(exports, module2) {
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
  "node_modules/mnemonist/sparse-queue-set.js"(exports, module2) {
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
  "node_modules/pandemonium/random-index.js"(exports, module2) {
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
  "node_modules/graphology-utils/getters.js"(exports) {
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
    exports.createNodeValueGetter = createNodeValueGetter;
    exports.createEdgeValueGetter = createEdgeValueGetter;
    exports.createEdgeWeightGetter = function(name2) {
      return createEdgeValueGetter(name2, coerceWeight);
    };
  }
});

// node_modules/graphology-indices/louvain.js
var require_louvain = __commonJS({
  "node_modules/graphology-indices/louvain.js"(exports) {
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
    exports.UndirectedLouvainIndex = UndirectedLouvainIndex;
    exports.DirectedLouvainIndex = DirectedLouvainIndex;
  }
});

// node_modules/graphology-communities-louvain/index.js
var require_graphology_communities_louvain = __commonJS({
  "node_modules/graphology-communities-louvain/index.js"(exports, module2) {
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
      var fn8 = type === "undirected" ? undirectedLouvain : directedLouvain;
      var results = fn8(detailed, graph, options);
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
    var fn7 = louvain2.bind(null, false, false);
    fn7.assign = louvain2.bind(null, true, false);
    fn7.detailed = louvain2.bind(null, false, true);
    fn7.defaults = DEFAULTS2;
    module2.exports = fn7;
  }
});

// node_modules/graphology-utils/add-node.js
var require_add_node = __commonJS({
  "node_modules/graphology-utils/add-node.js"(exports) {
    exports.copyNode = function(graph, key, attributes) {
      attributes = Object.assign({}, attributes);
      return graph.addNode(key, attributes);
    };
  }
});

// node_modules/graphology-utils/add-edge.js
var require_add_edge = __commonJS({
  "node_modules/graphology-utils/add-edge.js"(exports) {
    exports.addEdge = function addEdge2(graph, undirected, key, source, target, attributes) {
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
    exports.copyEdge = function copyEdge(graph, undirected, key, source, target, attributes) {
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
    exports.mergeEdge = function mergeEdge2(graph, undirected, key, source, target, attributes) {
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
    exports.updateEdge = function updateEdge(graph, undirected, key, source, target, updater) {
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
  "node_modules/graphology-operators/disjoint-union.js"(exports, module2) {
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
  "node_modules/graphology-operators/reverse.js"(exports, module2) {
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
  "node_modules/graphology-operators/subgraph.js"(exports, module2) {
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
  "node_modules/graphology-operators/to-directed.js"(exports, module2) {
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
  "node_modules/graphology-operators/to-mixed.js"(exports, module2) {
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
  "node_modules/graphology-operators/to-multi.js"(exports, module2) {
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
  "node_modules/graphology-operators/to-simple.js"(exports, module2) {
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
  "node_modules/graphology-operators/to-undirected.js"(exports, module2) {
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
  "node_modules/graphology-operators/union.js"(exports, module2) {
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
  "node_modules/graphology-operators/index.js"(exports) {
    exports.disjointUnion = require_disjoint_union();
    exports.reverse = require_reverse();
    exports.subgraph = require_subgraph();
    exports.toDirected = require_to_directed();
    exports.toMixed = require_to_mixed();
    exports.toMulti = require_to_multi();
    exports.toSimple = require_to_simple();
    exports.toUndirected = require_to_undirected();
    exports.union = require_union();
  }
});

// node_modules/ignore/index.js
var require_ignore = __commonJS({
  "node_modules/ignore/index.js"(exports, module2) {
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
    var basenameOf = (path17) => {
      const end = path17.length - 1;
      const index = path17.lastIndexOf(
        SLASH,
        path17[end] === SLASH ? end - 1 : end
      );
      return index < 0 ? path17 : path17.slice(index + 1);
    };
    var parentOf = (path17) => {
      if (path17.charCodeAt(0) === SLASH_CODE || path17.indexOf(DOUBLE_SLASH) >= 0) {
        const slices = path17.split(SLASH).filter(Boolean);
        slices.pop();
        return slices.length ? slices.join(SLASH) + SLASH : EMPTY;
      }
      const end = path17.length - 1;
      const cut = path17.lastIndexOf(
        SLASH,
        path17.charCodeAt(end) === SLASH_CODE ? end - 1 : end
      );
      return cut < 0 ? EMPTY : path17.slice(0, cut + 1);
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
      test(path17, checkUnignored, mode) {
        let ignored2 = false;
        let unignored = false;
        let matchedRule;
        const rules = this._rules;
        const { length } = rules;
        const shortcut = this._basenameCount * 2 >= length;
        const basename = shortcut ? basenameOf(path17) : path17;
        for (let index = 0; index < length; index++) {
          const rule = rules[index];
          const { negative } = rule;
          const skip = unignored === negative && ignored2 !== unignored || negative && !ignored2 && !unignored && !checkUnignored;
          if (!skip && rule[mode].test(
            shortcut && rule._basenameOnly ? basename : path17
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
    var checkPath = (path17, originalPath, doThrow) => {
      if (!isString(path17)) {
        return doThrow(
          `path must be a string, but got \`${originalPath}\``,
          TypeError
        );
      }
      if (!path17) {
        return doThrow(`path must not be empty`, TypeError);
      }
      if (checkPath.isNotRelative(path17)) {
        const r = "`path.relative()`d";
        return doThrow(
          `path should be a ${r} string, but got "${originalPath}"`,
          RangeError
        );
      }
      return true;
    };
    var isNotRelative = (path17) => {
      const first = path17.charCodeAt(0);
      if (first === SLASH_CODE) {
        return true;
      }
      if (first !== DOT_CODE) {
        return false;
      }
      if (path17.length === 1) {
        return true;
      }
      const second = path17.charCodeAt(1);
      if (second === SLASH_CODE) {
        return true;
      }
      if (second !== DOT_CODE) {
        return false;
      }
      return path17.length === 2 || path17.charCodeAt(2) === SLASH_CODE;
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
        const path17 = originalPath && checkPath.convert(originalPath);
        checkPath(
          path17,
          originalPath,
          this._strictPathCheck ? throwError : RETURN_FALSE
        );
        return this._t(path17, cache, checkUnignored);
      }
      checkIgnore(path17) {
        if (path17.charCodeAt(path17.length - 1) !== SLASH_CODE) {
          return this.test(path17);
        }
        const parentPath = parentOf(path17);
        if (parentPath) {
          const parent = this._t(parentPath, this._testCache, true);
          if (parent.ignored) {
            return parent;
          }
        }
        return this._rules.test(path17, false, MODE_CHECK_IGNORE);
      }
      _t(path17, cache, checkUnignored) {
        if (path17 in cache) {
          return cache[path17];
        }
        const parentPath = parentOf(path17);
        const parent = parentPath ? this._t(parentPath, cache, checkUnignored) : UNDEFINED;
        return cache[path17] = parent && parent.ignored ? parent : this._rules.test(path17, checkUnignored, MODE_IGNORE);
      }
      ignores(path17) {
        return this._test(path17, this._ignoreCache, false).ignored;
      }
      createFilter() {
        return (path17) => !this.ignores(path17);
      }
      filter(paths) {
        return makeArray(paths).filter(this.createFilter());
      }
      // @returns {TestResult}
      test(path17) {
        return this._test(path17, this._testCache, true);
      }
    };
    var factory = (options) => new Ignore(options);
    var isPathValid = (path17) => checkPath(path17 && checkPath.convert(path17), path17, RETURN_FALSE);
    var setupWindows = () => {
      const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
      checkPath.convert = makePosix;
      const REGEX_TEST_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
      checkPath.isNotRelative = (path17) => REGEX_TEST_WINDOWS_PATH_ABSOLUTE.test(path17) || isNotRelative(path17);
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
import path16 from "node:path";
import { pathToFileURL } from "node:url";

// engine/src/pipeline.ts
import { execFileSync } from "node:child_process";
import fs7 from "node:fs";
import path14 from "node:path";

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
  const fn7 = multi ? forEachMulti : forEachSimple;
  let found;
  if (type !== "undirected") {
    if (direction !== "out") {
      found = fn7(breakable, nodeData.in, callback);
      if (breakable && found) return found;
    }
    if (direction !== "in") {
      found = fn7(
        breakable,
        nodeData.out,
        callback,
        !direction ? nodeData.key : void 0
      );
      if (breakable && found) return found;
    }
  }
  if (type !== "directed") {
    found = fn7(breakable, nodeData.undirected, callback);
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
  const fn7 = multi ? forEachForKeyMulti : forEachForKeySimple;
  let found;
  if (type !== "undirected") {
    if (typeof sourceData.in !== "undefined" && direction !== "out") {
      found = fn7(breakable, sourceData.in, target, callback);
      if (breakable && found) return found;
    }
    if (typeof sourceData.out !== "undefined" && direction !== "in" && (direction || sourceData.key !== target)) {
      found = fn7(breakable, sourceData.out, target, callback);
      if (breakable && found) return found;
    }
  }
  if (type !== "directed") {
    if (typeof sourceData.undirected !== "undefined") {
      found = fn7(breakable, sourceData.undirected, target, callback);
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
  const neighbors2 = [];
  forEachNeighbor(false, type, direction, nodeData, function(key) {
    neighbors2.push(key);
  });
  return neighbors2;
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
    const fn7 = verb === "add" ? addEdge : mergeEdge;
    if (method.generateKey) {
      Graph.prototype[name2] = function(source, target, attributes) {
        return fn7(
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
        return fn7(
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
    // use (com grupo), require e include: ligação a arquivos do projeto (PSR-4 do composer.json).
    importTypes: S("namespace_use_declaration", "require_expression", "require_once_expression", "include_expression", "include_once_expression"),
    callTypes: S("function_call_expression", "member_call_expression", "nullsafe_member_call_expression", "scoped_call_expression", "object_creation_expression"),
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
    classTypes: S("class_definition", "enum_declaration", "mixin_declaration", "extension_declaration"),
    // O corpo vem ao lado da assinatura (function_body irmão), não dentro: ver bodyOf em extract-code.ts.
    functionTypes: S("function_signature", "method_signature"),
    importTypes: S("import_or_export"),
    // Chamada = um seletor com argument_part; quem é chamado vem antes dele (ver dartCallee).
    callTypes: S("selector"),
    callFunctionField: "",
    accessorTypes: S(),
    accessorField: "",
    accessorObjectField: "",
    nameFallback: ["identifier"],
    // Closures (onPressed: () { … }) contam para a função em volta.
    boundaryTypes: S(),
    importStyle: "dart"
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
var TYPED_IMPORT_EXT = /\.(php|dart|java|kt|kts|cs)$/;
var SAME_PACKAGE_EXT = /\.(java|kt|kts|cs)$/;
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
  const { byId, renames } = mergeNodes(extractions);
  const { edges: fileEdges, rawCalls } = renamedEdges(extractions, renames);
  const bindingsByFile = defaultImports(extractions, fileEdges);
  const { typeIndex, fnIndex } = definitionIndexes([...byId.values()]);
  const edges = collapseStubs(byId, typeIndex, fnIndex, fileEdges);
  const ctx = { byId, typeIndex, labelIndex: labelIndexOf(byId), importsTo: importsByFile(edges), bindingsByFile, callEdge: callEdgeAdder(edges) };
  for (const c of rawCalls) resolveCall(c, ctx);
  const methodEdges = new Set(edges.filter((e) => e.relation === "method").map((e) => `${e.source}->${e.target}`));
  const containsTargets = new Set(edges.filter((e) => e.relation === "contains").map((e) => e.target));
  for (const c of rawCalls) resolveMemberCall(c, extractions, ctx, methodEdges, containsTargets);
  for (const n of byId.values()) delete n.origin_file;
  return { nodes: [...byId.values()], edges };
}
function mergeNodes(extractions) {
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
  return { byId, renames };
}
function renamedEdges(extractions, renames) {
  const edges = [];
  const rawCalls = [];
  for (const [rel, ex] of extractions) {
    const r = renames.get(rel);
    const fix = (id) => r?.get(id) ?? id;
    for (const e of ex.edges) edges.push(r ? { ...e, source: fix(e.source), target: fix(e.target) } : e);
    for (const c of ex.rawCalls) rawCalls.push(r ? { ...c, caller: fix(c.caller) } : c);
  }
  return { edges, rawCalls };
}
function defaultImports(extractions, edges) {
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
  return bindingsByFile;
}
function definitionIndexes(nodes) {
  const typeIndex = /* @__PURE__ */ new Map();
  const fnIndex = /* @__PURE__ */ new Map();
  for (const n of nodes) {
    if (isTypeLike(n)) typeIndex.set(alnum(n.label), [...typeIndex.get(alnum(n.label)) ?? [], n]);
    else if (isTopFunction(n)) fnIndex.set(alnum(bareLabel(n.label)), [...fnIndex.get(alnum(bareLabel(n.label))) ?? [], n]);
  }
  return { typeIndex, fnIndex };
}
function collapseStubs(byId, typeIndex, fnIndex, edges) {
  const nodes = [...byId.values()];
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
  if (!stubMap.size) return edges;
  for (const id of stubMap.keys()) byId.delete(id);
  return edges.map((e) => ({ ...e, source: stubMap.get(e.source) ?? e.source, target: stubMap.get(e.target) ?? e.target }));
}
function labelIndexOf(byId) {
  const labelIndex = /* @__PURE__ */ new Map();
  for (const n of byId.values()) {
    if (!n.source_file || n.file_type === "rationale" || n.type === "namespace" || n.file_type === "document") continue;
    const k = bareLabel(n.label);
    labelIndex.set(k, [...labelIndex.get(k) ?? [], n]);
  }
  return labelIndex;
}
function importsByFile(edges) {
  const importsTo = /* @__PURE__ */ new Map();
  for (const e of edges) {
    if (e.relation !== "imports" && e.relation !== "imports_from") continue;
    if (!importsTo.has(e.source)) importsTo.set(e.source, /* @__PURE__ */ new Set());
    importsTo.get(e.source).add(e.target);
  }
  return importsTo;
}
function callEdgeAdder(edges) {
  const existingPairs = new Set(edges.filter((e) => e.relation === "calls" || e.relation === "indirect_call").map((e) => `${e.source}->${e.target}`));
  return (c, target, relation, confidence, score) => {
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
}
function resolveCall(c, ctx) {
  if (c.isMember || BUILTIN_GLOBALS.has(c.callee) || familyOf(c.sourceFile) === "markdown") return;
  const { target, evidence } = callTarget(c, ctx);
  if (!target || !target.source_file) return;
  if (c.indirect) {
    if (target._callable && !target._callable_class) ctx.callEdge(c, target.id, "indirect_call", "INFERRED", 0.85);
    return;
  }
  if (JS_EXT.test(c.sourceFile) && !evidence) return;
  ctx.callEdge(c, target.id, "calls", evidence ? "EXTRACTED" : "INFERRED", evidence ? 1 : 0.85);
}
function callTarget(c, ctx) {
  const binding = ctx.bindingsByFile.get(c.sourceFile)?.find((b) => b.local === c.callee);
  if (binding) {
    const target = ctx.byId.get(makeId(fileStem(binding.targetRel), binding.imported));
    if (target) return { target, evidence: true };
  }
  const fam = familyOf(c.sourceFile);
  const imported = ctx.importsTo.get(fileNodeId(c.sourceFile)) ?? /* @__PURE__ */ new Set();
  const cands = (ctx.labelIndex.get(c.callee) ?? []).filter((n) => familyOf(n.source_file) === fam && n.source_file !== c.sourceFile);
  const withEvidence = cands.filter((n) => imported.has(n.id) || imported.has(fileNodeId(n.source_file)));
  if (cands.length === 1) return { target: cands[0], evidence: withEvidence.length === 1 };
  if (withEvidence.length === 1) return { target: withEvidence[0], evidence: true };
  if (cands.length > 1) {
    const nonTest = cands.filter((n) => !/(^|\/)(tests?|__tests__)\/|\.(test|spec)\./.test(n.source_file));
    if (nonTest.length === 1) return { target: nonTest[0], evidence: false };
  }
  return { evidence: false };
}
function resolveMemberCall(c, extractions, ctx, methodEdges, containsTargets) {
  if (!c.isMember || !c.receiver || !(JS_EXT.test(c.sourceFile) || TYPED_IMPORT_EXT.test(c.sourceFile))) return;
  const table = extractions.get(c.sourceFile)?.typeTable ?? {};
  const qualified = /^[A-Z]/.test(c.receiver);
  const typeName = qualified ? c.receiver : table[c.receiver];
  if (!typeName || BUILTIN_GLOBALS.has(typeName)) return;
  const defs = (ctx.typeIndex.get(alnum(typeName)) ?? []).filter((n) => containsTargets.has(n.id) && ctx.byId.has(n.id));
  if (defs.length !== 1) return;
  const def = defs[0];
  const imported = ctx.importsTo.get(fileNodeId(c.sourceFile)) ?? /* @__PURE__ */ new Set();
  const samePackage = SAME_PACKAGE_EXT.test(c.sourceFile) && path3.posix.dirname(def.source_file) === path3.posix.dirname(c.sourceFile);
  const originOk = def.source_file === c.sourceFile || samePackage || imported.has(def.id) || imported.has(fileNodeId(def.source_file));
  if (!originOk) return;
  const methodId = makeId(def.id, c.callee);
  if (!ctx.byId.has(methodId) || !methodEdges.has(`${def.id}->${methodId}`)) return;
  ctx.callEdge(c, methodId, "calls", qualified ? "EXTRACTED" : "INFERRED", qualified ? 1 : 0.8);
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
var DEFAULT_SCORE = /* @__PURE__ */ new Map([["EXTRACTED", 1], ["INFERRED", 0.55]]);
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
      confidence_score: e.confidence_score ?? DEFAULT_SCORE.get(e.confidence) ?? 0.2,
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
import path9 from "node:path";

// engine/src/parser.ts
import fs2 from "node:fs";
import path6 from "node:path";

// node_modules/web-tree-sitter/tree-sitter.js
var __defProp2 = Object.defineProperty;
var __name = (target, value) => __defProp2(target, "name", { value, configurable: true });
var SIZE_OF_SHORT = 2;
var SIZE_OF_INT = 4;
var SIZE_OF_CURSOR = 4 * SIZE_OF_INT;
var SIZE_OF_NODE = 5 * SIZE_OF_INT;
var SIZE_OF_POINT = 2 * SIZE_OF_INT;
var SIZE_OF_RANGE = 2 * SIZE_OF_INT + 2 * SIZE_OF_POINT;
var ZERO_POINT = { row: 0, column: 0 };
var INTERNAL = /* @__PURE__ */ Symbol("INTERNAL");
function assertInternal(x) {
  if (x !== INTERNAL) throw new Error("Illegal constructor");
}
__name(assertInternal, "assertInternal");
function isPoint(point) {
  return !!point && typeof point.row === "number" && typeof point.column === "number";
}
__name(isPoint, "isPoint");
function setModule(module2) {
  C = module2;
}
__name(setModule, "setModule");
var C;
var LookaheadIterator = class {
  static {
    __name(this, "LookaheadIterator");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for WASM
  /** @internal */
  language;
  /** @internal */
  constructor(internal, address, language) {
    assertInternal(internal);
    this[0] = address;
    this.language = language;
  }
  /** Get the current symbol of the lookahead iterator. */
  get currentTypeId() {
    return C._ts_lookahead_iterator_current_symbol(this[0]);
  }
  /** Get the current symbol name of the lookahead iterator. */
  get currentType() {
    return this.language.types[this.currentTypeId] || "ERROR";
  }
  /** Delete the lookahead iterator, freeing its resources. */
  delete() {
    C._ts_lookahead_iterator_delete(this[0]);
    this[0] = 0;
  }
  /**
   * Reset the lookahead iterator.
   *
   * This returns `true` if the language was set successfully and `false`
   * otherwise.
   */
  reset(language, stateId) {
    if (C._ts_lookahead_iterator_reset(this[0], language[0], stateId)) {
      this.language = language;
      return true;
    }
    return false;
  }
  /**
   * Reset the lookahead iterator to another state.
   *
   * This returns `true` if the iterator was reset to the given state and
   * `false` otherwise.
   */
  resetState(stateId) {
    return Boolean(C._ts_lookahead_iterator_reset_state(this[0], stateId));
  }
  /**
   * Returns an iterator that iterates over the symbols of the lookahead iterator.
   *
   * The iterator will yield the current symbol name as a string for each step
   * until there are no more symbols to iterate over.
   */
  [Symbol.iterator]() {
    return {
      next: /* @__PURE__ */ __name(() => {
        if (C._ts_lookahead_iterator_next(this[0])) {
          return { done: false, value: this.currentType };
        }
        return { done: true, value: "" };
      }, "next")
    };
  }
};
function getText(tree, startIndex, endIndex, startPosition) {
  const length = endIndex - startIndex;
  let result = tree.textCallback(startIndex, startPosition);
  if (result) {
    startIndex += result.length;
    while (startIndex < endIndex) {
      const string = tree.textCallback(startIndex, startPosition);
      if (string && string.length > 0) {
        startIndex += string.length;
        result += string;
      } else {
        break;
      }
    }
    if (startIndex > endIndex) {
      result = result.slice(0, length);
    }
  }
  return result ?? "";
}
__name(getText, "getText");
var Tree = class _Tree {
  static {
    __name(this, "Tree");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for WASM
  /** @internal */
  textCallback;
  /** The language that was used to parse the syntax tree. */
  language;
  /** @internal */
  constructor(internal, address, language, textCallback) {
    assertInternal(internal);
    this[0] = address;
    this.language = language;
    this.textCallback = textCallback;
  }
  /** Create a shallow copy of the syntax tree. This is very fast. */
  copy() {
    const address = C._ts_tree_copy(this[0]);
    return new _Tree(INTERNAL, address, this.language, this.textCallback);
  }
  /** Delete the syntax tree, freeing its resources. */
  delete() {
    C._ts_tree_delete(this[0]);
    this[0] = 0;
  }
  /** Get the root node of the syntax tree. */
  get rootNode() {
    C._ts_tree_root_node_wasm(this[0]);
    return unmarshalNode(this);
  }
  /**
   * Get the root node of the syntax tree, but with its position shifted
   * forward by the given offset.
   */
  rootNodeWithOffset(offsetBytes, offsetExtent) {
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, offsetBytes, "i32");
    marshalPoint(address + SIZE_OF_INT, offsetExtent);
    C._ts_tree_root_node_with_offset_wasm(this[0]);
    return unmarshalNode(this);
  }
  /**
   * Edit the syntax tree to keep it in sync with source code that has been
   * edited.
   *
   * You must describe the edit both in terms of byte offsets and in terms of
   * row/column coordinates.
   */
  edit(edit) {
    marshalEdit(edit);
    C._ts_tree_edit_wasm(this[0]);
  }
  /** Create a new {@link TreeCursor} starting from the root of the tree. */
  walk() {
    return this.rootNode.walk();
  }
  /**
   * Compare this old edited syntax tree to a new syntax tree representing
   * the same document, returning a sequence of ranges whose syntactic
   * structure has changed.
   *
   * For this to work correctly, this syntax tree must have been edited such
   * that its ranges match up to the new tree. Generally, you'll want to
   * call this method right after calling one of the [`Parser::parse`]
   * functions. Call it on the old tree that was passed to parse, and
   * pass the new tree that was returned from `parse`.
   */
  getChangedRanges(other) {
    if (!(other instanceof _Tree)) {
      throw new TypeError("Argument must be a Tree");
    }
    C._ts_tree_get_changed_ranges_wasm(this[0], other[0]);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = unmarshalRange(address);
        address += SIZE_OF_RANGE;
      }
      C._free(buffer);
    }
    return result;
  }
  /** Get the included ranges that were used to parse the syntax tree. */
  getIncludedRanges() {
    C._ts_tree_included_ranges_wasm(this[0]);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = unmarshalRange(address);
        address += SIZE_OF_RANGE;
      }
      C._free(buffer);
    }
    return result;
  }
};
var TreeCursor = class _TreeCursor {
  static {
    __name(this, "TreeCursor");
  }
  /** @internal */
  // @ts-expect-error: never read
  [0] = 0;
  // Internal handle for Wasm
  /** @internal */
  // @ts-expect-error: never read
  [1] = 0;
  // Internal handle for Wasm
  /** @internal */
  // @ts-expect-error: never read
  [2] = 0;
  // Internal handle for Wasm
  /** @internal */
  // @ts-expect-error: never read
  [3] = 0;
  // Internal handle for Wasm
  /** @internal */
  tree;
  /** @internal */
  constructor(internal, tree) {
    assertInternal(internal);
    this.tree = tree;
    unmarshalTreeCursor(this);
  }
  /** Creates a deep copy of the tree cursor. This allocates new memory. */
  copy() {
    const copy = new _TreeCursor(INTERNAL, this.tree);
    C._ts_tree_cursor_copy_wasm(this.tree[0]);
    unmarshalTreeCursor(copy);
    return copy;
  }
  /** Delete the tree cursor, freeing its resources. */
  delete() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_delete_wasm(this.tree[0]);
    this[0] = this[1] = this[2] = 0;
  }
  /** Get the tree cursor's current {@link Node}. */
  get currentNode() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_current_node_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Get the numerical field id of this tree cursor's current node.
   *
   * See also {@link TreeCursor#currentFieldName}.
   */
  get currentFieldId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_field_id_wasm(this.tree[0]);
  }
  /** Get the field name of this tree cursor's current node. */
  get currentFieldName() {
    return this.tree.language.fields[this.currentFieldId];
  }
  /**
   * Get the depth of the cursor's current node relative to the original
   * node that the cursor was constructed with.
   */
  get currentDepth() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_depth_wasm(this.tree[0]);
  }
  /**
   * Get the index of the cursor's current node out of all of the
   * descendants of the original node that the cursor was constructed with.
   */
  get currentDescendantIndex() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_descendant_index_wasm(this.tree[0]);
  }
  /** Get the type of the cursor's current node. */
  get nodeType() {
    return this.tree.language.types[this.nodeTypeId] || "ERROR";
  }
  /** Get the type id of the cursor's current node. */
  get nodeTypeId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_type_id_wasm(this.tree[0]);
  }
  /** Get the state id of the cursor's current node. */
  get nodeStateId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_state_id_wasm(this.tree[0]);
  }
  /** Get the id of the cursor's current node. */
  get nodeId() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_id_wasm(this.tree[0]);
  }
  /**
   * Check if the cursor's current node is *named*.
   *
   * Named nodes correspond to named rules in the grammar, whereas
   * *anonymous* nodes correspond to string literals in the grammar.
   */
  get nodeIsNamed() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_is_named_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if the cursor's current node is *missing*.
   *
   * Missing nodes are inserted by the parser in order to recover from
   * certain kinds of syntax errors.
   */
  get nodeIsMissing() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_current_node_is_missing_wasm(this.tree[0]) === 1;
  }
  /** Get the string content of the cursor's current node. */
  get nodeText() {
    marshalTreeCursor(this);
    const startIndex = C._ts_tree_cursor_start_index_wasm(this.tree[0]);
    const endIndex = C._ts_tree_cursor_end_index_wasm(this.tree[0]);
    C._ts_tree_cursor_start_position_wasm(this.tree[0]);
    const startPosition = unmarshalPoint(TRANSFER_BUFFER);
    return getText(this.tree, startIndex, endIndex, startPosition);
  }
  /** Get the start position of the cursor's current node. */
  get startPosition() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_start_position_wasm(this.tree[0]);
    return unmarshalPoint(TRANSFER_BUFFER);
  }
  /** Get the end position of the cursor's current node. */
  get endPosition() {
    marshalTreeCursor(this);
    C._ts_tree_cursor_end_position_wasm(this.tree[0]);
    return unmarshalPoint(TRANSFER_BUFFER);
  }
  /** Get the start index of the cursor's current node. */
  get startIndex() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_start_index_wasm(this.tree[0]);
  }
  /** Get the end index of the cursor's current node. */
  get endIndex() {
    marshalTreeCursor(this);
    return C._ts_tree_cursor_end_index_wasm(this.tree[0]);
  }
  /**
   * Move this cursor to the first child of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there were no children.
   */
  gotoFirstChild() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_first_child_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the last child of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there were no children.
   *
   * Note that this function may be slower than
   * {@link TreeCursor#gotoFirstChild} because it needs to
   * iterate through all the children to compute the child's position.
   */
  gotoLastChild() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_last_child_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the parent of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there was no parent node (the cursor was already on the
   * root node).
   *
   * Note that the node the cursor was constructed with is considered the root
   * of the cursor, and the cursor cannot walk outside this node.
   */
  gotoParent() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_parent_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the next sibling of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there was no next sibling node.
   *
   * Note that the node the cursor was constructed with is considered the root
   * of the cursor, and the cursor cannot walk outside this node.
   */
  gotoNextSibling() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_next_sibling_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the previous sibling of its current node.
   *
   * This returns `true` if the cursor successfully moved, and returns
   * `false` if there was no previous sibling node.
   *
   * Note that this function may be slower than
   * {@link TreeCursor#gotoNextSibling} due to how node
   * positions are stored. In the worst case, this will need to iterate
   * through all the children up to the previous sibling node to recalculate
   * its position. Also note that the node the cursor was constructed with is
   * considered the root of the cursor, and the cursor cannot walk outside this node.
   */
  gotoPreviousSibling() {
    marshalTreeCursor(this);
    const result = C._ts_tree_cursor_goto_previous_sibling_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move the cursor to the node that is the nth descendant of
   * the original node that the cursor was constructed with, where
   * zero represents the original node itself.
   */
  gotoDescendant(goalDescendantIndex) {
    marshalTreeCursor(this);
    C._ts_tree_cursor_goto_descendant_wasm(this.tree[0], goalDescendantIndex);
    unmarshalTreeCursor(this);
  }
  /**
   * Move this cursor to the first child of its current node that contains or
   * starts after the given byte offset.
   *
   * This returns `true` if the cursor successfully moved to a child node, and returns
   * `false` if no such child was found.
   */
  gotoFirstChildForIndex(goalIndex) {
    marshalTreeCursor(this);
    C.setValue(TRANSFER_BUFFER + SIZE_OF_CURSOR, goalIndex, "i32");
    const result = C._ts_tree_cursor_goto_first_child_for_index_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Move this cursor to the first child of its current node that contains or
   * starts after the given byte offset.
   *
   * This returns the index of the child node if one was found, and returns
   * `null` if no such child was found.
   */
  gotoFirstChildForPosition(goalPosition) {
    marshalTreeCursor(this);
    marshalPoint(TRANSFER_BUFFER + SIZE_OF_CURSOR, goalPosition);
    const result = C._ts_tree_cursor_goto_first_child_for_position_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
    return result === 1;
  }
  /**
   * Re-initialize this tree cursor to start at the original node that the
   * cursor was constructed with.
   */
  reset(node) {
    marshalNode(node);
    marshalTreeCursor(this, TRANSFER_BUFFER + SIZE_OF_NODE);
    C._ts_tree_cursor_reset_wasm(this.tree[0]);
    unmarshalTreeCursor(this);
  }
  /**
   * Re-initialize a tree cursor to the same position as another cursor.
   *
   * Unlike {@link TreeCursor#reset}, this will not lose parent
   * information and allows reusing already created cursors.
   */
  resetTo(cursor) {
    marshalTreeCursor(this, TRANSFER_BUFFER);
    marshalTreeCursor(cursor, TRANSFER_BUFFER + SIZE_OF_CURSOR);
    C._ts_tree_cursor_reset_to_wasm(this.tree[0], cursor.tree[0]);
    unmarshalTreeCursor(this);
  }
};
var Node = class {
  static {
    __name(this, "Node");
  }
  /** @internal */
  // @ts-expect-error: never read
  [0] = 0;
  // Internal handle for Wasm
  /** @internal */
  _children;
  /** @internal */
  _namedChildren;
  /** @internal */
  constructor(internal, {
    id,
    tree,
    startIndex,
    startPosition,
    other
  }) {
    assertInternal(internal);
    this[0] = other;
    this.id = id;
    this.tree = tree;
    this.startIndex = startIndex;
    this.startPosition = startPosition;
  }
  /**
   * The numeric id for this node that is unique.
   *
   * Within a given syntax tree, no two nodes have the same id. However:
   *
   * * If a new tree is created based on an older tree, and a node from the old tree is reused in
   *   the process, then that node will have the same id in both trees.
   *
   * * A node not marked as having changes does not guarantee it was reused.
   *
   * * If a node is marked as having changed in the old tree, it will not be reused.
   */
  id;
  /** The byte index where this node starts. */
  startIndex;
  /** The position where this node starts. */
  startPosition;
  /** The tree that this node belongs to. */
  tree;
  /** Get this node's type as a numerical id. */
  get typeId() {
    marshalNode(this);
    return C._ts_node_symbol_wasm(this.tree[0]);
  }
  /**
   * Get the node's type as a numerical id as it appears in the grammar,
   * ignoring aliases.
   */
  get grammarId() {
    marshalNode(this);
    return C._ts_node_grammar_symbol_wasm(this.tree[0]);
  }
  /** Get this node's type as a string. */
  get type() {
    return this.tree.language.types[this.typeId] || "ERROR";
  }
  /**
   * Get this node's symbol name as it appears in the grammar, ignoring
   * aliases as a string.
   */
  get grammarType() {
    return this.tree.language.types[this.grammarId] || "ERROR";
  }
  /**
   * Check if this node is *named*.
   *
   * Named nodes correspond to named rules in the grammar, whereas
   * *anonymous* nodes correspond to string literals in the grammar.
   */
  get isNamed() {
    marshalNode(this);
    return C._ts_node_is_named_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if this node is *extra*.
   *
   * Extra nodes represent things like comments, which are not required
   * by the grammar, but can appear anywhere.
   */
  get isExtra() {
    marshalNode(this);
    return C._ts_node_is_extra_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if this node represents a syntax error.
   *
   * Syntax errors represent parts of the code that could not be incorporated
   * into a valid syntax tree.
   */
  get isError() {
    marshalNode(this);
    return C._ts_node_is_error_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if this node is *missing*.
   *
   * Missing nodes are inserted by the parser in order to recover from
   * certain kinds of syntax errors.
   */
  get isMissing() {
    marshalNode(this);
    return C._ts_node_is_missing_wasm(this.tree[0]) === 1;
  }
  /** Check if this node has been edited. */
  get hasChanges() {
    marshalNode(this);
    return C._ts_node_has_changes_wasm(this.tree[0]) === 1;
  }
  /**
   * Check if this node represents a syntax error or contains any syntax
   * errors anywhere within it.
   */
  get hasError() {
    marshalNode(this);
    return C._ts_node_has_error_wasm(this.tree[0]) === 1;
  }
  /** Get the byte index where this node ends. */
  get endIndex() {
    marshalNode(this);
    return C._ts_node_end_index_wasm(this.tree[0]);
  }
  /** Get the position where this node ends. */
  get endPosition() {
    marshalNode(this);
    C._ts_node_end_point_wasm(this.tree[0]);
    return unmarshalPoint(TRANSFER_BUFFER);
  }
  /** Get the string content of this node. */
  get text() {
    return getText(this.tree, this.startIndex, this.endIndex, this.startPosition);
  }
  /** Get this node's parse state. */
  get parseState() {
    marshalNode(this);
    return C._ts_node_parse_state_wasm(this.tree[0]);
  }
  /** Get the parse state after this node. */
  get nextParseState() {
    marshalNode(this);
    return C._ts_node_next_parse_state_wasm(this.tree[0]);
  }
  /** Check if this node is equal to another node. */
  equals(other) {
    return this.tree === other.tree && this.id === other.id;
  }
  /**
   * Get the node's child at the given index, where zero represents the first child.
   *
   * This method is fairly fast, but its cost is technically log(n), so if
   * you might be iterating over a long list of children, you should use
   * {@link Node#children} instead.
   */
  child(index) {
    marshalNode(this);
    C._ts_node_child_wasm(this.tree[0], index);
    return unmarshalNode(this.tree);
  }
  /**
   * Get this node's *named* child at the given index.
   *
   * See also {@link Node#isNamed}.
   * This method is fairly fast, but its cost is technically log(n), so if
   * you might be iterating over a long list of children, you should use
   * {@link Node#namedChildren} instead.
   */
  namedChild(index) {
    marshalNode(this);
    C._ts_node_named_child_wasm(this.tree[0], index);
    return unmarshalNode(this.tree);
  }
  /**
   * Get this node's child with the given numerical field id.
   *
   * See also {@link Node#childForFieldName}. You can
   * convert a field name to an id using {@link Language#fieldIdForName}.
   */
  childForFieldId(fieldId) {
    marshalNode(this);
    C._ts_node_child_by_field_id_wasm(this.tree[0], fieldId);
    return unmarshalNode(this.tree);
  }
  /**
   * Get the first child with the given field name.
   *
   * If multiple children may have the same field name, access them using
   * {@link Node#childrenForFieldName}.
   */
  childForFieldName(fieldName) {
    const fieldId = this.tree.language.fields.indexOf(fieldName);
    if (fieldId !== -1) return this.childForFieldId(fieldId);
    return null;
  }
  /** Get the field name of this node's child at the given index. */
  fieldNameForChild(index) {
    marshalNode(this);
    const address = C._ts_node_field_name_for_child_wasm(this.tree[0], index);
    if (!address) return null;
    return C.AsciiToString(address);
  }
  /** Get the field name of this node's named child at the given index. */
  fieldNameForNamedChild(index) {
    marshalNode(this);
    const address = C._ts_node_field_name_for_named_child_wasm(this.tree[0], index);
    if (!address) return null;
    return C.AsciiToString(address);
  }
  /**
   * Get an array of this node's children with a given field name.
   *
   * See also {@link Node#children}.
   */
  childrenForFieldName(fieldName) {
    const fieldId = this.tree.language.fields.indexOf(fieldName);
    if (fieldId !== -1 && fieldId !== 0) return this.childrenForFieldId(fieldId);
    return [];
  }
  /**
    * Get an array of this node's children with a given field id.
    *
    * See also {@link Node#childrenForFieldName}.
    */
  childrenForFieldId(fieldId) {
    marshalNode(this);
    C._ts_node_children_by_field_id_wasm(this.tree[0], fieldId);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = unmarshalNode(this.tree, address);
        address += SIZE_OF_NODE;
      }
      C._free(buffer);
    }
    return result;
  }
  /** Get the node's first child that contains or starts after the given byte offset. */
  firstChildForIndex(index) {
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, index, "i32");
    C._ts_node_first_child_for_byte_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the node's first named child that contains or starts after the given byte offset. */
  firstNamedChildForIndex(index) {
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, index, "i32");
    C._ts_node_first_named_child_for_byte_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get this node's number of children. */
  get childCount() {
    marshalNode(this);
    return C._ts_node_child_count_wasm(this.tree[0]);
  }
  /**
   * Get this node's number of *named* children.
   *
   * See also {@link Node#isNamed}.
   */
  get namedChildCount() {
    marshalNode(this);
    return C._ts_node_named_child_count_wasm(this.tree[0]);
  }
  /** Get this node's first child. */
  get firstChild() {
    return this.child(0);
  }
  /**
   * Get this node's first named child.
   *
   * See also {@link Node#isNamed}.
   */
  get firstNamedChild() {
    return this.namedChild(0);
  }
  /** Get this node's last child. */
  get lastChild() {
    return this.child(this.childCount - 1);
  }
  /**
   * Get this node's last named child.
   *
   * See also {@link Node#isNamed}.
   */
  get lastNamedChild() {
    return this.namedChild(this.namedChildCount - 1);
  }
  /**
   * Iterate over this node's children.
   *
   * If you're walking the tree recursively, you may want to use the
   * {@link TreeCursor} APIs directly instead.
   */
  get children() {
    if (!this._children) {
      marshalNode(this);
      C._ts_node_children_wasm(this.tree[0]);
      const count = C.getValue(TRANSFER_BUFFER, "i32");
      const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      this._children = new Array(count);
      if (count > 0) {
        let address = buffer;
        for (let i2 = 0; i2 < count; i2++) {
          this._children[i2] = unmarshalNode(this.tree, address);
          address += SIZE_OF_NODE;
        }
        C._free(buffer);
      }
    }
    return this._children;
  }
  /**
   * Iterate over this node's named children.
   *
   * See also {@link Node#children}.
   */
  get namedChildren() {
    if (!this._namedChildren) {
      marshalNode(this);
      C._ts_node_named_children_wasm(this.tree[0]);
      const count = C.getValue(TRANSFER_BUFFER, "i32");
      const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      this._namedChildren = new Array(count);
      if (count > 0) {
        let address = buffer;
        for (let i2 = 0; i2 < count; i2++) {
          this._namedChildren[i2] = unmarshalNode(this.tree, address);
          address += SIZE_OF_NODE;
        }
        C._free(buffer);
      }
    }
    return this._namedChildren;
  }
  /**
   * Get the descendants of this node that are the given type, or in the given types array.
   *
   * The types array should contain node type strings, which can be retrieved from {@link Language#types}.
   *
   * Additionally, a `startPosition` and `endPosition` can be passed in to restrict the search to a byte range.
   */
  descendantsOfType(types, startPosition = ZERO_POINT, endPosition = ZERO_POINT) {
    if (!Array.isArray(types)) types = [types];
    const symbols = [];
    const typesBySymbol = this.tree.language.types;
    for (const node_type of types) {
      if (node_type == "ERROR") {
        symbols.push(65535);
      }
    }
    for (let i2 = 0, n = typesBySymbol.length; i2 < n; i2++) {
      if (types.includes(typesBySymbol[i2])) {
        symbols.push(i2);
      }
    }
    const symbolsAddress = C._malloc(SIZE_OF_INT * symbols.length);
    for (let i2 = 0, n = symbols.length; i2 < n; i2++) {
      C.setValue(symbolsAddress + i2 * SIZE_OF_INT, symbols[i2], "i32");
    }
    marshalNode(this);
    C._ts_node_descendants_of_type_wasm(
      this.tree[0],
      symbolsAddress,
      symbols.length,
      startPosition.row,
      startPosition.column,
      endPosition.row,
      endPosition.column
    );
    const descendantCount = C.getValue(TRANSFER_BUFFER, "i32");
    const descendantAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(descendantCount);
    if (descendantCount > 0) {
      let address = descendantAddress;
      for (let i2 = 0; i2 < descendantCount; i2++) {
        result[i2] = unmarshalNode(this.tree, address);
        address += SIZE_OF_NODE;
      }
    }
    C._free(descendantAddress);
    C._free(symbolsAddress);
    return result;
  }
  /** Get this node's next sibling. */
  get nextSibling() {
    marshalNode(this);
    C._ts_node_next_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get this node's previous sibling. */
  get previousSibling() {
    marshalNode(this);
    C._ts_node_prev_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Get this node's next *named* sibling.
   *
   * See also {@link Node#isNamed}.
   */
  get nextNamedSibling() {
    marshalNode(this);
    C._ts_node_next_named_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Get this node's previous *named* sibling.
   *
   * See also {@link Node#isNamed}.
   */
  get previousNamedSibling() {
    marshalNode(this);
    C._ts_node_prev_named_sibling_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the node's number of descendants, including one for the node itself. */
  get descendantCount() {
    marshalNode(this);
    return C._ts_node_descendant_count_wasm(this.tree[0]);
  }
  /**
   * Get this node's immediate parent.
   * Prefer {@link Node#childWithDescendant} for iterating over this node's ancestors.
   */
  get parent() {
    marshalNode(this);
    C._ts_node_parent_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Get the node that contains `descendant`.
   *
   * Note that this can return `descendant` itself.
   */
  childWithDescendant(descendant) {
    marshalNode(this);
    marshalNode(descendant, 1);
    C._ts_node_child_with_descendant_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the smallest node within this node that spans the given byte range. */
  descendantForIndex(start2, end = start2) {
    if (typeof start2 !== "number" || typeof end !== "number") {
      throw new Error("Arguments must be numbers");
    }
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, start2, "i32");
    C.setValue(address + SIZE_OF_INT, end, "i32");
    C._ts_node_descendant_for_index_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the smallest named node within this node that spans the given byte range. */
  namedDescendantForIndex(start2, end = start2) {
    if (typeof start2 !== "number" || typeof end !== "number") {
      throw new Error("Arguments must be numbers");
    }
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    C.setValue(address, start2, "i32");
    C.setValue(address + SIZE_OF_INT, end, "i32");
    C._ts_node_named_descendant_for_index_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the smallest node within this node that spans the given point range. */
  descendantForPosition(start2, end = start2) {
    if (!isPoint(start2) || !isPoint(end)) {
      throw new Error("Arguments must be {row, column} objects");
    }
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    marshalPoint(address, start2);
    marshalPoint(address + SIZE_OF_POINT, end);
    C._ts_node_descendant_for_position_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /** Get the smallest named node within this node that spans the given point range. */
  namedDescendantForPosition(start2, end = start2) {
    if (!isPoint(start2) || !isPoint(end)) {
      throw new Error("Arguments must be {row, column} objects");
    }
    marshalNode(this);
    const address = TRANSFER_BUFFER + SIZE_OF_NODE;
    marshalPoint(address, start2);
    marshalPoint(address + SIZE_OF_POINT, end);
    C._ts_node_named_descendant_for_position_wasm(this.tree[0]);
    return unmarshalNode(this.tree);
  }
  /**
   * Create a new {@link TreeCursor} starting from this node.
   *
   * Note that the given node is considered the root of the cursor,
   * and the cursor cannot walk outside this node.
   */
  walk() {
    marshalNode(this);
    C._ts_tree_cursor_new_wasm(this.tree[0]);
    return new TreeCursor(INTERNAL, this.tree);
  }
  /**
   * Edit this node to keep it in-sync with source code that has been edited.
   *
   * This function is only rarely needed. When you edit a syntax tree with
   * the {@link Tree#edit} method, all of the nodes that you retrieve from
   * the tree afterward will already reflect the edit. You only need to
   * use {@link Node#edit} when you have a specific {@link Node} instance that
   * you want to keep and continue to use after an edit.
   */
  edit(edit) {
    if (this.startIndex >= edit.oldEndIndex) {
      this.startIndex = edit.newEndIndex + (this.startIndex - edit.oldEndIndex);
      let subbedPointRow;
      let subbedPointColumn;
      if (this.startPosition.row > edit.oldEndPosition.row) {
        subbedPointRow = this.startPosition.row - edit.oldEndPosition.row;
        subbedPointColumn = this.startPosition.column;
      } else {
        subbedPointRow = 0;
        subbedPointColumn = this.startPosition.column;
        if (this.startPosition.column >= edit.oldEndPosition.column) {
          subbedPointColumn = this.startPosition.column - edit.oldEndPosition.column;
        }
      }
      if (subbedPointRow > 0) {
        this.startPosition.row += subbedPointRow;
        this.startPosition.column = subbedPointColumn;
      } else {
        this.startPosition.column += subbedPointColumn;
      }
    } else if (this.startIndex > edit.startIndex) {
      this.startIndex = edit.newEndIndex;
      this.startPosition.row = edit.newEndPosition.row;
      this.startPosition.column = edit.newEndPosition.column;
    }
  }
  /** Get the S-expression representation of this node. */
  toString() {
    marshalNode(this);
    const address = C._ts_node_to_string_wasm(this.tree[0]);
    const result = C.AsciiToString(address);
    C._free(address);
    return result;
  }
};
function unmarshalCaptures(query2, tree, address, patternIndex, result) {
  for (let i2 = 0, n = result.length; i2 < n; i2++) {
    const captureIndex = C.getValue(address, "i32");
    address += SIZE_OF_INT;
    const node = unmarshalNode(tree, address);
    address += SIZE_OF_NODE;
    result[i2] = { patternIndex, name: query2.captureNames[captureIndex], node };
  }
  return address;
}
__name(unmarshalCaptures, "unmarshalCaptures");
function marshalNode(node, index = 0) {
  let address = TRANSFER_BUFFER + index * SIZE_OF_NODE;
  C.setValue(address, node.id, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node.startIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node.startPosition.row, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node.startPosition.column, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, node[0], "i32");
}
__name(marshalNode, "marshalNode");
function unmarshalNode(tree, address = TRANSFER_BUFFER) {
  const id = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  if (id === 0) return null;
  const index = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  const row = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  const column = C.getValue(address, "i32");
  address += SIZE_OF_INT;
  const other = C.getValue(address, "i32");
  const result = new Node(INTERNAL, {
    id,
    tree,
    startIndex: index,
    startPosition: { row, column },
    other
  });
  return result;
}
__name(unmarshalNode, "unmarshalNode");
function marshalTreeCursor(cursor, address = TRANSFER_BUFFER) {
  C.setValue(address + 0 * SIZE_OF_INT, cursor[0], "i32");
  C.setValue(address + 1 * SIZE_OF_INT, cursor[1], "i32");
  C.setValue(address + 2 * SIZE_OF_INT, cursor[2], "i32");
  C.setValue(address + 3 * SIZE_OF_INT, cursor[3], "i32");
}
__name(marshalTreeCursor, "marshalTreeCursor");
function unmarshalTreeCursor(cursor) {
  cursor[0] = C.getValue(TRANSFER_BUFFER + 0 * SIZE_OF_INT, "i32");
  cursor[1] = C.getValue(TRANSFER_BUFFER + 1 * SIZE_OF_INT, "i32");
  cursor[2] = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
  cursor[3] = C.getValue(TRANSFER_BUFFER + 3 * SIZE_OF_INT, "i32");
}
__name(unmarshalTreeCursor, "unmarshalTreeCursor");
function marshalPoint(address, point) {
  C.setValue(address, point.row, "i32");
  C.setValue(address + SIZE_OF_INT, point.column, "i32");
}
__name(marshalPoint, "marshalPoint");
function unmarshalPoint(address) {
  const result = {
    row: C.getValue(address, "i32") >>> 0,
    column: C.getValue(address + SIZE_OF_INT, "i32") >>> 0
  };
  return result;
}
__name(unmarshalPoint, "unmarshalPoint");
function marshalRange(address, range) {
  marshalPoint(address, range.startPosition);
  address += SIZE_OF_POINT;
  marshalPoint(address, range.endPosition);
  address += SIZE_OF_POINT;
  C.setValue(address, range.startIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, range.endIndex, "i32");
  address += SIZE_OF_INT;
}
__name(marshalRange, "marshalRange");
function unmarshalRange(address) {
  const result = {};
  result.startPosition = unmarshalPoint(address);
  address += SIZE_OF_POINT;
  result.endPosition = unmarshalPoint(address);
  address += SIZE_OF_POINT;
  result.startIndex = C.getValue(address, "i32") >>> 0;
  address += SIZE_OF_INT;
  result.endIndex = C.getValue(address, "i32") >>> 0;
  return result;
}
__name(unmarshalRange, "unmarshalRange");
function marshalEdit(edit, address = TRANSFER_BUFFER) {
  marshalPoint(address, edit.startPosition);
  address += SIZE_OF_POINT;
  marshalPoint(address, edit.oldEndPosition);
  address += SIZE_OF_POINT;
  marshalPoint(address, edit.newEndPosition);
  address += SIZE_OF_POINT;
  C.setValue(address, edit.startIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, edit.oldEndIndex, "i32");
  address += SIZE_OF_INT;
  C.setValue(address, edit.newEndIndex, "i32");
  address += SIZE_OF_INT;
}
__name(marshalEdit, "marshalEdit");
function unmarshalLanguageMetadata(address) {
  const major_version = C.getValue(address, "i32");
  const minor_version = C.getValue(address += SIZE_OF_INT, "i32");
  const patch_version = C.getValue(address += SIZE_OF_INT, "i32");
  return { major_version, minor_version, patch_version };
}
__name(unmarshalLanguageMetadata, "unmarshalLanguageMetadata");
var PREDICATE_STEP_TYPE_CAPTURE = 1;
var PREDICATE_STEP_TYPE_STRING = 2;
var QUERY_WORD_REGEX = /[\w-]+/g;
var CaptureQuantifier = {
  Zero: 0,
  ZeroOrOne: 1,
  ZeroOrMore: 2,
  One: 3,
  OneOrMore: 4
};
var isCaptureStep = /* @__PURE__ */ __name((step) => step.type === "capture", "isCaptureStep");
var isStringStep = /* @__PURE__ */ __name((step) => step.type === "string", "isStringStep");
var QueryErrorKind = {
  Syntax: 1,
  NodeName: 2,
  FieldName: 3,
  CaptureName: 4,
  PatternStructure: 5
};
var QueryError = class _QueryError extends Error {
  constructor(kind, info2, index, length) {
    super(_QueryError.formatMessage(kind, info2));
    this.kind = kind;
    this.info = info2;
    this.index = index;
    this.length = length;
    this.name = "QueryError";
  }
  static {
    __name(this, "QueryError");
  }
  /** Formats an error message based on the error kind and info */
  static formatMessage(kind, info2) {
    switch (kind) {
      case QueryErrorKind.NodeName:
        return `Bad node name '${info2.word}'`;
      case QueryErrorKind.FieldName:
        return `Bad field name '${info2.word}'`;
      case QueryErrorKind.CaptureName:
        return `Bad capture name @${info2.word}`;
      case QueryErrorKind.PatternStructure:
        return `Bad pattern structure at offset ${info2.suffix}`;
      case QueryErrorKind.Syntax:
        return `Bad syntax at offset ${info2.suffix}`;
    }
  }
};
function parseAnyPredicate(steps, index, operator2, textPredicates) {
  if (steps.length !== 3) {
    throw new Error(
      `Wrong number of arguments to \`#${operator2}\` predicate. Expected 2, got ${steps.length - 1}`
    );
  }
  if (!isCaptureStep(steps[1])) {
    throw new Error(
      `First argument of \`#${operator2}\` predicate must be a capture. Got "${steps[1].value}"`
    );
  }
  const isPositive = operator2 === "eq?" || operator2 === "any-eq?";
  const matchAll = !operator2.startsWith("any-");
  if (isCaptureStep(steps[2])) {
    const captureName1 = steps[1].name;
    const captureName2 = steps[2].name;
    textPredicates[index].push((captures) => {
      const nodes1 = [];
      const nodes2 = [];
      for (const c of captures) {
        if (c.name === captureName1) nodes1.push(c.node);
        if (c.name === captureName2) nodes2.push(c.node);
      }
      const compare = /* @__PURE__ */ __name((n1, n2, positive) => {
        return positive ? n1.text === n2.text : n1.text !== n2.text;
      }, "compare");
      return matchAll ? nodes1.every((n1) => nodes2.some((n2) => compare(n1, n2, isPositive))) : nodes1.some((n1) => nodes2.some((n2) => compare(n1, n2, isPositive)));
    });
  } else {
    const captureName = steps[1].name;
    const stringValue = steps[2].value;
    const matches = /* @__PURE__ */ __name((n) => n.text === stringValue, "matches");
    const doesNotMatch = /* @__PURE__ */ __name((n) => n.text !== stringValue, "doesNotMatch");
    textPredicates[index].push((captures) => {
      const nodes = [];
      for (const c of captures) {
        if (c.name === captureName) nodes.push(c.node);
      }
      const test = isPositive ? matches : doesNotMatch;
      return matchAll ? nodes.every(test) : nodes.some(test);
    });
  }
}
__name(parseAnyPredicate, "parseAnyPredicate");
function parseMatchPredicate(steps, index, operator2, textPredicates) {
  if (steps.length !== 3) {
    throw new Error(
      `Wrong number of arguments to \`#${operator2}\` predicate. Expected 2, got ${steps.length - 1}.`
    );
  }
  if (steps[1].type !== "capture") {
    throw new Error(
      `First argument of \`#${operator2}\` predicate must be a capture. Got "${steps[1].value}".`
    );
  }
  if (steps[2].type !== "string") {
    throw new Error(
      `Second argument of \`#${operator2}\` predicate must be a string. Got @${steps[2].name}.`
    );
  }
  const isPositive = operator2 === "match?" || operator2 === "any-match?";
  const matchAll = !operator2.startsWith("any-");
  const captureName = steps[1].name;
  const regex = new RegExp(steps[2].value);
  textPredicates[index].push((captures) => {
    const nodes = [];
    for (const c of captures) {
      if (c.name === captureName) nodes.push(c.node.text);
    }
    const test = /* @__PURE__ */ __name((text, positive) => {
      return positive ? regex.test(text) : !regex.test(text);
    }, "test");
    if (nodes.length === 0) return !isPositive;
    return matchAll ? nodes.every((text) => test(text, isPositive)) : nodes.some((text) => test(text, isPositive));
  });
}
__name(parseMatchPredicate, "parseMatchPredicate");
function parseAnyOfPredicate(steps, index, operator2, textPredicates) {
  if (steps.length < 2) {
    throw new Error(
      `Wrong number of arguments to \`#${operator2}\` predicate. Expected at least 1. Got ${steps.length - 1}.`
    );
  }
  if (steps[1].type !== "capture") {
    throw new Error(
      `First argument of \`#${operator2}\` predicate must be a capture. Got "${steps[1].value}".`
    );
  }
  const isPositive = operator2 === "any-of?";
  const captureName = steps[1].name;
  const stringSteps = steps.slice(2);
  if (!stringSteps.every(isStringStep)) {
    throw new Error(
      `Arguments to \`#${operator2}\` predicate must be strings.".`
    );
  }
  const values = stringSteps.map((s) => s.value);
  textPredicates[index].push((captures) => {
    const nodes = [];
    for (const c of captures) {
      if (c.name === captureName) nodes.push(c.node.text);
    }
    if (nodes.length === 0) return !isPositive;
    return nodes.every((text) => values.includes(text)) === isPositive;
  });
}
__name(parseAnyOfPredicate, "parseAnyOfPredicate");
function parseIsPredicate(steps, index, operator2, assertedProperties, refutedProperties) {
  if (steps.length < 2 || steps.length > 3) {
    throw new Error(
      `Wrong number of arguments to \`#${operator2}\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`
    );
  }
  if (!steps.every(isStringStep)) {
    throw new Error(
      `Arguments to \`#${operator2}\` predicate must be strings.".`
    );
  }
  const properties = operator2 === "is?" ? assertedProperties : refutedProperties;
  if (!properties[index]) properties[index] = {};
  properties[index][steps[1].value] = steps[2]?.value ?? null;
}
__name(parseIsPredicate, "parseIsPredicate");
function parseSetDirective(steps, index, setProperties) {
  if (steps.length < 2 || steps.length > 3) {
    throw new Error(`Wrong number of arguments to \`#set!\` predicate. Expected 1 or 2. Got ${steps.length - 1}.`);
  }
  if (!steps.every(isStringStep)) {
    throw new Error(`Arguments to \`#set!\` predicate must be strings.".`);
  }
  if (!setProperties[index]) setProperties[index] = {};
  setProperties[index][steps[1].value] = steps[2]?.value ?? null;
}
__name(parseSetDirective, "parseSetDirective");
function parsePattern(index, stepType, stepValueId, captureNames, stringValues, steps, textPredicates, predicates, setProperties, assertedProperties, refutedProperties) {
  if (stepType === PREDICATE_STEP_TYPE_CAPTURE) {
    const name2 = captureNames[stepValueId];
    steps.push({ type: "capture", name: name2 });
  } else if (stepType === PREDICATE_STEP_TYPE_STRING) {
    steps.push({ type: "string", value: stringValues[stepValueId] });
  } else if (steps.length > 0) {
    if (steps[0].type !== "string") {
      throw new Error("Predicates must begin with a literal value");
    }
    const operator2 = steps[0].value;
    switch (operator2) {
      case "any-not-eq?":
      case "not-eq?":
      case "any-eq?":
      case "eq?":
        parseAnyPredicate(steps, index, operator2, textPredicates);
        break;
      case "any-not-match?":
      case "not-match?":
      case "any-match?":
      case "match?":
        parseMatchPredicate(steps, index, operator2, textPredicates);
        break;
      case "not-any-of?":
      case "any-of?":
        parseAnyOfPredicate(steps, index, operator2, textPredicates);
        break;
      case "is?":
      case "is-not?":
        parseIsPredicate(steps, index, operator2, assertedProperties, refutedProperties);
        break;
      case "set!":
        parseSetDirective(steps, index, setProperties);
        break;
      default:
        predicates[index].push({ operator: operator2, operands: steps.slice(1) });
    }
    steps.length = 0;
  }
}
__name(parsePattern, "parsePattern");
var Query = class {
  static {
    __name(this, "Query");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for WASM
  /** @internal */
  exceededMatchLimit;
  /** @internal */
  textPredicates;
  /** The names of the captures used in the query. */
  captureNames;
  /** The quantifiers of the captures used in the query. */
  captureQuantifiers;
  /**
   * The other user-defined predicates associated with the given index.
   *
   * This includes predicates with operators other than:
   * - `match?`
   * - `eq?` and `not-eq?`
   * - `any-of?` and `not-any-of?`
   * - `is?` and `is-not?`
   * - `set!`
   */
  predicates;
  /** The properties for predicates with the operator `set!`. */
  setProperties;
  /** The properties for predicates with the operator `is?`. */
  assertedProperties;
  /** The properties for predicates with the operator `is-not?`. */
  refutedProperties;
  /** The maximum number of in-progress matches for this cursor. */
  matchLimit;
  /**
   * Create a new query from a string containing one or more S-expression
   * patterns.
   *
   * The query is associated with a particular language, and can only be run
   * on syntax nodes parsed with that language. References to Queries can be
   * shared between multiple threads.
   *
   * @link {@see https://tree-sitter.github.io/tree-sitter/using-parsers/queries}
   */
  constructor(language, source) {
    const sourceLength = C.lengthBytesUTF8(source);
    const sourceAddress = C._malloc(sourceLength + 1);
    C.stringToUTF8(source, sourceAddress, sourceLength + 1);
    const address = C._ts_query_new(
      language[0],
      sourceAddress,
      sourceLength,
      TRANSFER_BUFFER,
      TRANSFER_BUFFER + SIZE_OF_INT
    );
    if (!address) {
      const errorId = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
      const errorByte = C.getValue(TRANSFER_BUFFER, "i32");
      const errorIndex = C.UTF8ToString(sourceAddress, errorByte).length;
      const suffix = source.slice(errorIndex, errorIndex + 100).split("\n")[0];
      const word = suffix.match(QUERY_WORD_REGEX)?.[0] ?? "";
      C._free(sourceAddress);
      switch (errorId) {
        case QueryErrorKind.Syntax:
          throw new QueryError(QueryErrorKind.Syntax, { suffix: `${errorIndex}: '${suffix}'...` }, errorIndex, 0);
        case QueryErrorKind.NodeName:
          throw new QueryError(errorId, { word }, errorIndex, word.length);
        case QueryErrorKind.FieldName:
          throw new QueryError(errorId, { word }, errorIndex, word.length);
        case QueryErrorKind.CaptureName:
          throw new QueryError(errorId, { word }, errorIndex, word.length);
        case QueryErrorKind.PatternStructure:
          throw new QueryError(errorId, { suffix: `${errorIndex}: '${suffix}'...` }, errorIndex, 0);
      }
    }
    const stringCount = C._ts_query_string_count(address);
    const captureCount = C._ts_query_capture_count(address);
    const patternCount = C._ts_query_pattern_count(address);
    const captureNames = new Array(captureCount);
    const captureQuantifiers = new Array(patternCount);
    const stringValues = new Array(stringCount);
    for (let i2 = 0; i2 < captureCount; i2++) {
      const nameAddress = C._ts_query_capture_name_for_id(
        address,
        i2,
        TRANSFER_BUFFER
      );
      const nameLength = C.getValue(TRANSFER_BUFFER, "i32");
      captureNames[i2] = C.UTF8ToString(nameAddress, nameLength);
    }
    for (let i2 = 0; i2 < patternCount; i2++) {
      const captureQuantifiersArray = new Array(captureCount);
      for (let j = 0; j < captureCount; j++) {
        const quantifier = C._ts_query_capture_quantifier_for_id(address, i2, j);
        captureQuantifiersArray[j] = quantifier;
      }
      captureQuantifiers[i2] = captureQuantifiersArray;
    }
    for (let i2 = 0; i2 < stringCount; i2++) {
      const valueAddress = C._ts_query_string_value_for_id(
        address,
        i2,
        TRANSFER_BUFFER
      );
      const nameLength = C.getValue(TRANSFER_BUFFER, "i32");
      stringValues[i2] = C.UTF8ToString(valueAddress, nameLength);
    }
    const setProperties = new Array(patternCount);
    const assertedProperties = new Array(patternCount);
    const refutedProperties = new Array(patternCount);
    const predicates = new Array(patternCount);
    const textPredicates = new Array(patternCount);
    for (let i2 = 0; i2 < patternCount; i2++) {
      const predicatesAddress = C._ts_query_predicates_for_pattern(address, i2, TRANSFER_BUFFER);
      const stepCount = C.getValue(TRANSFER_BUFFER, "i32");
      predicates[i2] = [];
      textPredicates[i2] = [];
      const steps = new Array();
      let stepAddress = predicatesAddress;
      for (let j = 0; j < stepCount; j++) {
        const stepType = C.getValue(stepAddress, "i32");
        stepAddress += SIZE_OF_INT;
        const stepValueId = C.getValue(stepAddress, "i32");
        stepAddress += SIZE_OF_INT;
        parsePattern(
          i2,
          stepType,
          stepValueId,
          captureNames,
          stringValues,
          steps,
          textPredicates,
          predicates,
          setProperties,
          assertedProperties,
          refutedProperties
        );
      }
      Object.freeze(textPredicates[i2]);
      Object.freeze(predicates[i2]);
      Object.freeze(setProperties[i2]);
      Object.freeze(assertedProperties[i2]);
      Object.freeze(refutedProperties[i2]);
    }
    C._free(sourceAddress);
    this[0] = address;
    this.captureNames = captureNames;
    this.captureQuantifiers = captureQuantifiers;
    this.textPredicates = textPredicates;
    this.predicates = predicates;
    this.setProperties = setProperties;
    this.assertedProperties = assertedProperties;
    this.refutedProperties = refutedProperties;
    this.exceededMatchLimit = false;
  }
  /** Delete the query, freeing its resources. */
  delete() {
    C._ts_query_delete(this[0]);
    this[0] = 0;
  }
  /**
   * Iterate over all of the matches in the order that they were found.
   *
   * Each match contains the index of the pattern that matched, and a list of
   * captures. Because multiple patterns can match the same set of nodes,
   * one match may contain captures that appear *before* some of the
   * captures from a previous match.
   *
   * @param {Node} node - The node to execute the query on.
   *
   * @param {QueryOptions} options - Options for query execution.
   */
  matches(node, options = {}) {
    const startPosition = options.startPosition ?? ZERO_POINT;
    const endPosition = options.endPosition ?? ZERO_POINT;
    const startIndex = options.startIndex ?? 0;
    const endIndex = options.endIndex ?? 0;
    const matchLimit = options.matchLimit ?? 4294967295;
    const maxStartDepth = options.maxStartDepth ?? 4294967295;
    const timeoutMicros = options.timeoutMicros ?? 0;
    const progressCallback = options.progressCallback;
    if (typeof matchLimit !== "number") {
      throw new Error("Arguments must be numbers");
    }
    this.matchLimit = matchLimit;
    if (endIndex !== 0 && startIndex > endIndex) {
      throw new Error("`startIndex` cannot be greater than `endIndex`");
    }
    if (endPosition !== ZERO_POINT && (startPosition.row > endPosition.row || startPosition.row === endPosition.row && startPosition.column > endPosition.column)) {
      throw new Error("`startPosition` cannot be greater than `endPosition`");
    }
    if (progressCallback) {
      C.currentQueryProgressCallback = progressCallback;
    }
    marshalNode(node);
    C._ts_query_matches_wasm(
      this[0],
      node.tree[0],
      startPosition.row,
      startPosition.column,
      endPosition.row,
      endPosition.column,
      startIndex,
      endIndex,
      matchLimit,
      maxStartDepth,
      timeoutMicros
    );
    const rawCount = C.getValue(TRANSFER_BUFFER, "i32");
    const startAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const didExceedMatchLimit = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
    const result = new Array(rawCount);
    this.exceededMatchLimit = Boolean(didExceedMatchLimit);
    let filteredCount = 0;
    let address = startAddress;
    for (let i2 = 0; i2 < rawCount; i2++) {
      const patternIndex = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const captureCount = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const captures = new Array(captureCount);
      address = unmarshalCaptures(this, node.tree, address, patternIndex, captures);
      if (this.textPredicates[patternIndex].every((p) => p(captures))) {
        result[filteredCount] = { pattern: patternIndex, patternIndex, captures };
        const setProperties = this.setProperties[patternIndex];
        result[filteredCount].setProperties = setProperties;
        const assertedProperties = this.assertedProperties[patternIndex];
        result[filteredCount].assertedProperties = assertedProperties;
        const refutedProperties = this.refutedProperties[patternIndex];
        result[filteredCount].refutedProperties = refutedProperties;
        filteredCount++;
      }
    }
    result.length = filteredCount;
    C._free(startAddress);
    C.currentQueryProgressCallback = null;
    return result;
  }
  /**
   * Iterate over all of the individual captures in the order that they
   * appear.
   *
   * This is useful if you don't care about which pattern matched, and just
   * want a single, ordered sequence of captures.
   *
   * @param {Node} node - The node to execute the query on.
   *
   * @param {QueryOptions} options - Options for query execution.
   */
  captures(node, options = {}) {
    const startPosition = options.startPosition ?? ZERO_POINT;
    const endPosition = options.endPosition ?? ZERO_POINT;
    const startIndex = options.startIndex ?? 0;
    const endIndex = options.endIndex ?? 0;
    const matchLimit = options.matchLimit ?? 4294967295;
    const maxStartDepth = options.maxStartDepth ?? 4294967295;
    const timeoutMicros = options.timeoutMicros ?? 0;
    const progressCallback = options.progressCallback;
    if (typeof matchLimit !== "number") {
      throw new Error("Arguments must be numbers");
    }
    this.matchLimit = matchLimit;
    if (endIndex !== 0 && startIndex > endIndex) {
      throw new Error("`startIndex` cannot be greater than `endIndex`");
    }
    if (endPosition !== ZERO_POINT && (startPosition.row > endPosition.row || startPosition.row === endPosition.row && startPosition.column > endPosition.column)) {
      throw new Error("`startPosition` cannot be greater than `endPosition`");
    }
    if (progressCallback) {
      C.currentQueryProgressCallback = progressCallback;
    }
    marshalNode(node);
    C._ts_query_captures_wasm(
      this[0],
      node.tree[0],
      startPosition.row,
      startPosition.column,
      endPosition.row,
      endPosition.column,
      startIndex,
      endIndex,
      matchLimit,
      maxStartDepth,
      timeoutMicros
    );
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const startAddress = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const didExceedMatchLimit = C.getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
    const result = new Array();
    this.exceededMatchLimit = Boolean(didExceedMatchLimit);
    const captures = new Array();
    let address = startAddress;
    for (let i2 = 0; i2 < count; i2++) {
      const patternIndex = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const captureCount = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      const captureIndex = C.getValue(address, "i32");
      address += SIZE_OF_INT;
      captures.length = captureCount;
      address = unmarshalCaptures(this, node.tree, address, patternIndex, captures);
      if (this.textPredicates[patternIndex].every((p) => p(captures))) {
        const capture = captures[captureIndex];
        const setProperties = this.setProperties[patternIndex];
        capture.setProperties = setProperties;
        const assertedProperties = this.assertedProperties[patternIndex];
        capture.assertedProperties = assertedProperties;
        const refutedProperties = this.refutedProperties[patternIndex];
        capture.refutedProperties = refutedProperties;
        result.push(capture);
      }
    }
    C._free(startAddress);
    C.currentQueryProgressCallback = null;
    return result;
  }
  /** Get the predicates for a given pattern. */
  predicatesForPattern(patternIndex) {
    return this.predicates[patternIndex];
  }
  /**
   * Disable a certain capture within a query.
   *
   * This prevents the capture from being returned in matches, and also
   * avoids any resource usage associated with recording the capture.
   */
  disableCapture(captureName) {
    const captureNameLength = C.lengthBytesUTF8(captureName);
    const captureNameAddress = C._malloc(captureNameLength + 1);
    C.stringToUTF8(captureName, captureNameAddress, captureNameLength + 1);
    C._ts_query_disable_capture(this[0], captureNameAddress, captureNameLength);
    C._free(captureNameAddress);
  }
  /**
   * Disable a certain pattern within a query.
   *
   * This prevents the pattern from matching, and also avoids any resource
   * usage associated with the pattern. This throws an error if the pattern
   * index is out of bounds.
   */
  disablePattern(patternIndex) {
    if (patternIndex >= this.predicates.length) {
      throw new Error(
        `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
      );
    }
    C._ts_query_disable_pattern(this[0], patternIndex);
  }
  /**
   * Check if, on its last execution, this cursor exceeded its maximum number
   * of in-progress matches.
   */
  didExceedMatchLimit() {
    return this.exceededMatchLimit;
  }
  /** Get the byte offset where the given pattern starts in the query's source. */
  startIndexForPattern(patternIndex) {
    if (patternIndex >= this.predicates.length) {
      throw new Error(
        `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
      );
    }
    return C._ts_query_start_byte_for_pattern(this[0], patternIndex);
  }
  /** Get the byte offset where the given pattern ends in the query's source. */
  endIndexForPattern(patternIndex) {
    if (patternIndex >= this.predicates.length) {
      throw new Error(
        `Pattern index is ${patternIndex} but the pattern count is ${this.predicates.length}`
      );
    }
    return C._ts_query_end_byte_for_pattern(this[0], patternIndex);
  }
  /** Get the number of patterns in the query. */
  patternCount() {
    return C._ts_query_pattern_count(this[0]);
  }
  /** Get the index for a given capture name. */
  captureIndexForName(captureName) {
    return this.captureNames.indexOf(captureName);
  }
  /** Check if a given pattern within a query has a single root node. */
  isPatternRooted(patternIndex) {
    return C._ts_query_is_pattern_rooted(this[0], patternIndex) === 1;
  }
  /** Check if a given pattern within a query has a single root node. */
  isPatternNonLocal(patternIndex) {
    return C._ts_query_is_pattern_non_local(this[0], patternIndex) === 1;
  }
  /**
   * Check if a given step in a query is 'definite'.
   *
   * A query step is 'definite' if its parent pattern will be guaranteed to
   * match successfully once it reaches the step.
   */
  isPatternGuaranteedAtStep(byteIndex) {
    return C._ts_query_is_pattern_guaranteed_at_step(this[0], byteIndex) === 1;
  }
};
var LANGUAGE_FUNCTION_REGEX = /^tree_sitter_\w+$/;
var Language = class _Language {
  static {
    __name(this, "Language");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for WASM
  /**
   * A list of all node types in the language. The index of each type in this
   * array is its node type id.
   */
  types;
  /**
   * A list of all field names in the language. The index of each field name in
   * this array is its field id.
   */
  fields;
  /** @internal */
  constructor(internal, address) {
    assertInternal(internal);
    this[0] = address;
    this.types = new Array(C._ts_language_symbol_count(this[0]));
    for (let i2 = 0, n = this.types.length; i2 < n; i2++) {
      if (C._ts_language_symbol_type(this[0], i2) < 2) {
        this.types[i2] = C.UTF8ToString(C._ts_language_symbol_name(this[0], i2));
      }
    }
    this.fields = new Array(C._ts_language_field_count(this[0]) + 1);
    for (let i2 = 0, n = this.fields.length; i2 < n; i2++) {
      const fieldName = C._ts_language_field_name_for_id(this[0], i2);
      if (fieldName !== 0) {
        this.fields[i2] = C.UTF8ToString(fieldName);
      } else {
        this.fields[i2] = null;
      }
    }
  }
  /**
   * Gets the name of the language.
   */
  get name() {
    const ptr = C._ts_language_name(this[0]);
    if (ptr === 0) return null;
    return C.UTF8ToString(ptr);
  }
  /**
   * @deprecated since version 0.25.0, use {@link Language#abiVersion} instead
   * Gets the version of the language.
   */
  get version() {
    return C._ts_language_version(this[0]);
  }
  /**
   * Gets the ABI version of the language.
   */
  get abiVersion() {
    return C._ts_language_abi_version(this[0]);
  }
  /**
  * Get the metadata for this language. This information is generated by the
  * CLI, and relies on the language author providing the correct metadata in
  * the language's `tree-sitter.json` file.
  */
  get metadata() {
    C._ts_language_metadata(this[0]);
    const length = C.getValue(TRANSFER_BUFFER, "i32");
    const address = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    if (length === 0) return null;
    return unmarshalLanguageMetadata(address);
  }
  /**
   * Gets the number of fields in the language.
   */
  get fieldCount() {
    return this.fields.length - 1;
  }
  /**
   * Gets the number of states in the language.
   */
  get stateCount() {
    return C._ts_language_state_count(this[0]);
  }
  /**
   * Get the field id for a field name.
   */
  fieldIdForName(fieldName) {
    const result = this.fields.indexOf(fieldName);
    return result !== -1 ? result : null;
  }
  /**
   * Get the field name for a field id.
   */
  fieldNameForId(fieldId) {
    return this.fields[fieldId] ?? null;
  }
  /**
   * Get the node type id for a node type name.
   */
  idForNodeType(type, named) {
    const typeLength = C.lengthBytesUTF8(type);
    const typeAddress = C._malloc(typeLength + 1);
    C.stringToUTF8(type, typeAddress, typeLength + 1);
    const result = C._ts_language_symbol_for_name(this[0], typeAddress, typeLength, named ? 1 : 0);
    C._free(typeAddress);
    return result || null;
  }
  /**
   * Gets the number of node types in the language.
   */
  get nodeTypeCount() {
    return C._ts_language_symbol_count(this[0]);
  }
  /**
   * Get the node type name for a node type id.
   */
  nodeTypeForId(typeId) {
    const name2 = C._ts_language_symbol_name(this[0], typeId);
    return name2 ? C.UTF8ToString(name2) : null;
  }
  /**
   * Check if a node type is named.
   *
   * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/2-basic-parsing.html#named-vs-anonymous-nodes}
   */
  nodeTypeIsNamed(typeId) {
    return C._ts_language_type_is_named_wasm(this[0], typeId) ? true : false;
  }
  /**
   * Check if a node type is visible.
   */
  nodeTypeIsVisible(typeId) {
    return C._ts_language_type_is_visible_wasm(this[0], typeId) ? true : false;
  }
  /**
   * Get the supertypes ids of this language.
   *
   * @see {@link https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types.html?highlight=supertype#supertype-nodes}
   */
  get supertypes() {
    C._ts_language_supertypes_wasm(this[0]);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = C.getValue(address, "i16");
        address += SIZE_OF_SHORT;
      }
    }
    return result;
  }
  /**
   * Get the subtype ids for a given supertype node id.
   */
  subtypes(supertype) {
    C._ts_language_subtypes_wasm(this[0], supertype);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = C.getValue(address, "i16");
        address += SIZE_OF_SHORT;
      }
    }
    return result;
  }
  /**
   * Get the next state id for a given state id and node type id.
   */
  nextState(stateId, typeId) {
    return C._ts_language_next_state(this[0], stateId, typeId);
  }
  /**
   * Create a new lookahead iterator for this language and parse state.
   *
   * This returns `null` if state is invalid for this language.
   *
   * Iterating {@link LookaheadIterator} will yield valid symbols in the given
   * parse state. Newly created lookahead iterators will return the `ERROR`
   * symbol from {@link LookaheadIterator#currentType}.
   *
   * Lookahead iterators can be useful for generating suggestions and improving
   * syntax error diagnostics. To get symbols valid in an `ERROR` node, use the
   * lookahead iterator on its first leaf node state. For `MISSING` nodes, a
   * lookahead iterator created on the previous non-extra leaf node may be
   * appropriate.
   */
  lookaheadIterator(stateId) {
    const address = C._ts_lookahead_iterator_new(this[0], stateId);
    if (address) return new LookaheadIterator(INTERNAL, address, this);
    return null;
  }
  /**
   * @deprecated since version 0.25.0, call `new` on a {@link Query} instead
   *
   * Create a new query from a string containing one or more S-expression
   * patterns.
   *
   * The query is associated with a particular language, and can only be run
   * on syntax nodes parsed with that language. References to Queries can be
   * shared between multiple threads.
   *
   * @link {@see https://tree-sitter.github.io/tree-sitter/using-parsers/queries}
   */
  query(source) {
    console.warn("Language.query is deprecated. Use new Query(language, source) instead.");
    return new Query(this, source);
  }
  /**
   * Load a language from a WebAssembly module.
   * The module can be provided as a path to a file or as a buffer.
   */
  static async load(input) {
    let bytes;
    if (input instanceof Uint8Array) {
      bytes = Promise.resolve(input);
    } else {
      if (globalThis.process?.versions.node) {
        const fs22 = await import("fs/promises");
        bytes = fs22.readFile(input);
      } else {
        bytes = fetch(input).then((response) => response.arrayBuffer().then((buffer) => {
          if (response.ok) {
            return new Uint8Array(buffer);
          } else {
            const body2 = new TextDecoder("utf-8").decode(buffer);
            throw new Error(`Language.load failed with status ${response.status}.

${body2}`);
          }
        }));
      }
    }
    const mod = await C.loadWebAssemblyModule(await bytes, { loadAsync: true });
    const symbolNames = Object.keys(mod);
    const functionName2 = symbolNames.find((key) => LANGUAGE_FUNCTION_REGEX.test(key) && !key.includes("external_scanner_"));
    if (!functionName2) {
      console.log(`Couldn't find language function in WASM file. Symbols:
${JSON.stringify(symbolNames, null, 2)}`);
      throw new Error("Language.load failed: no language function found in WASM file");
    }
    const languageAddress = mod[functionName2]();
    return new _Language(INTERNAL, languageAddress);
  }
};
var Module2 = (() => {
  var _scriptName = import.meta.url;
  return async function(moduleArg = {}) {
    var moduleRtn;
    var Module = moduleArg;
    var readyPromiseResolve, readyPromiseReject;
    var readyPromise = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
    var ENVIRONMENT_IS_WEB = typeof window == "object";
    var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";
    var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && process.type != "renderer";
    var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
    if (ENVIRONMENT_IS_NODE) {
      const { createRequire } = await import("module");
      var require = createRequire(import.meta.url);
    }
    Module.currentQueryProgressCallback = null;
    Module.currentProgressCallback = null;
    Module.currentLogCallback = null;
    Module.currentParseCallback = null;
    var moduleOverrides = Object.assign({}, Module);
    var arguments_ = [];
    var thisProgram = "./this.program";
    var quit_ = /* @__PURE__ */ __name((status, toThrow) => {
      throw toThrow;
    }, "quit_");
    var scriptDirectory = "";
    function locateFile(path17) {
      if (Module["locateFile"]) {
        return Module["locateFile"](path17, scriptDirectory);
      }
      return scriptDirectory + path17;
    }
    __name(locateFile, "locateFile");
    var readAsync, readBinary;
    if (ENVIRONMENT_IS_NODE) {
      var fs = require("fs");
      var nodePath = require("path");
      if (!import.meta.url.startsWith("data:")) {
        scriptDirectory = nodePath.dirname(require("url").fileURLToPath(import.meta.url)) + "/";
      }
      readBinary = /* @__PURE__ */ __name((filename) => {
        filename = isFileURI(filename) ? new URL(filename) : filename;
        var ret = fs.readFileSync(filename);
        return ret;
      }, "readBinary");
      readAsync = /* @__PURE__ */ __name(async (filename, binary2 = true) => {
        filename = isFileURI(filename) ? new URL(filename) : filename;
        var ret = fs.readFileSync(filename, binary2 ? void 0 : "utf8");
        return ret;
      }, "readAsync");
      if (!Module["thisProgram"] && process.argv.length > 1) {
        thisProgram = process.argv[1].replace(/\\/g, "/");
      }
      arguments_ = process.argv.slice(2);
      quit_ = /* @__PURE__ */ __name((status, toThrow) => {
        process.exitCode = status;
        throw toThrow;
      }, "quit_");
    } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href;
      } else if (typeof document != "undefined" && document.currentScript) {
        scriptDirectory = document.currentScript.src;
      }
      if (_scriptName) {
        scriptDirectory = _scriptName;
      }
      if (scriptDirectory.startsWith("blob:")) {
        scriptDirectory = "";
      } else {
        scriptDirectory = scriptDirectory.slice(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
      }
      {
        if (ENVIRONMENT_IS_WORKER) {
          readBinary = /* @__PURE__ */ __name((url) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(
              /** @type{!ArrayBuffer} */
              xhr.response
            );
          }, "readBinary");
        }
        readAsync = /* @__PURE__ */ __name(async (url) => {
          if (isFileURI(url)) {
            return new Promise((resolve, reject) => {
              var xhr = new XMLHttpRequest();
              xhr.open("GET", url, true);
              xhr.responseType = "arraybuffer";
              xhr.onload = () => {
                if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                  resolve(xhr.response);
                  return;
                }
                reject(xhr.status);
              };
              xhr.onerror = reject;
              xhr.send(null);
            });
          }
          var response = await fetch(url, {
            credentials: "same-origin"
          });
          if (response.ok) {
            return response.arrayBuffer();
          }
          throw new Error(response.status + " : " + response.url);
        }, "readAsync");
      }
    } else {
    }
    var out = Module["print"] || console.log.bind(console);
    var err = Module["printErr"] || console.error.bind(console);
    Object.assign(Module, moduleOverrides);
    moduleOverrides = null;
    if (Module["arguments"]) arguments_ = Module["arguments"];
    if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
    var dynamicLibraries = Module["dynamicLibraries"] || [];
    var wasmBinary = Module["wasmBinary"];
    var wasmMemory;
    var ABORT = false;
    var EXITSTATUS;
    function assert(condition, text) {
      if (!condition) {
        abort(text);
      }
    }
    __name(assert, "assert");
    var HEAP, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAP64, HEAPU64, HEAPF64;
    var HEAP_DATA_VIEW;
    var runtimeInitialized = false;
    var isFileURI = /* @__PURE__ */ __name((filename) => filename.startsWith("file://"), "isFileURI");
    function updateMemoryViews() {
      var b = wasmMemory.buffer;
      Module["HEAP_DATA_VIEW"] = HEAP_DATA_VIEW = new DataView(b);
      Module["HEAP8"] = HEAP8 = new Int8Array(b);
      Module["HEAP16"] = HEAP16 = new Int16Array(b);
      Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
      Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
      Module["HEAP32"] = HEAP32 = new Int32Array(b);
      Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
      Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
      Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
      Module["HEAP64"] = HEAP64 = new BigInt64Array(b);
      Module["HEAPU64"] = HEAPU64 = new BigUint64Array(b);
    }
    __name(updateMemoryViews, "updateMemoryViews");
    if (Module["wasmMemory"]) {
      wasmMemory = Module["wasmMemory"];
    } else {
      var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 33554432;
      wasmMemory = new WebAssembly.Memory({
        "initial": INITIAL_MEMORY / 65536,
        // In theory we should not need to emit the maximum if we want "unlimited"
        // or 4GB of memory, but VMs error on that atm, see
        // https://github.com/emscripten-core/emscripten/issues/14130
        // And in the pthreads case we definitely need to emit a maximum. So
        // always emit one.
        "maximum": 32768
      });
    }
    updateMemoryViews();
    var __RELOC_FUNCS__ = [];
    function preRun() {
      if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
          addOnPreRun(Module["preRun"].shift());
        }
      }
      callRuntimeCallbacks(onPreRuns);
    }
    __name(preRun, "preRun");
    function initRuntime() {
      runtimeInitialized = true;
      callRuntimeCallbacks(__RELOC_FUNCS__);
      wasmExports["__wasm_call_ctors"]();
      callRuntimeCallbacks(onPostCtors);
    }
    __name(initRuntime, "initRuntime");
    function preMain() {
    }
    __name(preMain, "preMain");
    function postRun() {
      if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
          addOnPostRun(Module["postRun"].shift());
        }
      }
      callRuntimeCallbacks(onPostRuns);
    }
    __name(postRun, "postRun");
    var runDependencies = 0;
    var dependenciesFulfilled = null;
    function getUniqueRunDependency(id) {
      return id;
    }
    __name(getUniqueRunDependency, "getUniqueRunDependency");
    function addRunDependency(id) {
      runDependencies++;
      Module["monitorRunDependencies"]?.(runDependencies);
    }
    __name(addRunDependency, "addRunDependency");
    function removeRunDependency(id) {
      runDependencies--;
      Module["monitorRunDependencies"]?.(runDependencies);
      if (runDependencies == 0) {
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback();
        }
      }
    }
    __name(removeRunDependency, "removeRunDependency");
    function abort(what) {
      Module["onAbort"]?.(what);
      what = "Aborted(" + what + ")";
      err(what);
      ABORT = true;
      what += ". Build with -sASSERTIONS for more info.";
      var e = new WebAssembly.RuntimeError(what);
      readyPromiseReject(e);
      throw e;
    }
    __name(abort, "abort");
    var wasmBinaryFile;
    function findWasmBinary() {
      if (Module["locateFile"]) {
        return locateFile("tree-sitter.wasm");
      }
      return new URL("tree-sitter.wasm", import.meta.url).href;
    }
    __name(findWasmBinary, "findWasmBinary");
    function getBinarySync(file) {
      if (file == wasmBinaryFile && wasmBinary) {
        return new Uint8Array(wasmBinary);
      }
      if (readBinary) {
        return readBinary(file);
      }
      throw "both async and sync fetching of the wasm failed";
    }
    __name(getBinarySync, "getBinarySync");
    async function getWasmBinary(binaryFile) {
      if (!wasmBinary) {
        try {
          var response = await readAsync(binaryFile);
          return new Uint8Array(response);
        } catch {
        }
      }
      return getBinarySync(binaryFile);
    }
    __name(getWasmBinary, "getWasmBinary");
    async function instantiateArrayBuffer(binaryFile, imports) {
      try {
        var binary2 = await getWasmBinary(binaryFile);
        var instance2 = await WebAssembly.instantiate(binary2, imports);
        return instance2;
      } catch (reason) {
        err(`failed to asynchronously prepare wasm: ${reason}`);
        abort(reason);
      }
    }
    __name(instantiateArrayBuffer, "instantiateArrayBuffer");
    async function instantiateAsync(binary2, binaryFile, imports) {
      if (!binary2 && typeof WebAssembly.instantiateStreaming == "function" && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE) {
        try {
          var response = fetch(binaryFile, {
            credentials: "same-origin"
          });
          var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
          return instantiationResult;
        } catch (reason) {
          err(`wasm streaming compile failed: ${reason}`);
          err("falling back to ArrayBuffer instantiation");
        }
      }
      return instantiateArrayBuffer(binaryFile, imports);
    }
    __name(instantiateAsync, "instantiateAsync");
    function getWasmImports() {
      return {
        "env": wasmImports,
        "wasi_snapshot_preview1": wasmImports,
        "GOT.mem": new Proxy(wasmImports, GOTHandler),
        "GOT.func": new Proxy(wasmImports, GOTHandler)
      };
    }
    __name(getWasmImports, "getWasmImports");
    async function createWasm() {
      function receiveInstance(instance2, module2) {
        wasmExports = instance2.exports;
        wasmExports = relocateExports(wasmExports, 1024);
        var metadata2 = getDylinkMetadata(module2);
        if (metadata2.neededDynlibs) {
          dynamicLibraries = metadata2.neededDynlibs.concat(dynamicLibraries);
        }
        mergeLibSymbols(wasmExports, "main");
        LDSO.init();
        loadDylibs();
        __RELOC_FUNCS__.push(wasmExports["__wasm_apply_data_relocs"]);
        removeRunDependency("wasm-instantiate");
        return wasmExports;
      }
      __name(receiveInstance, "receiveInstance");
      addRunDependency("wasm-instantiate");
      function receiveInstantiationResult(result2) {
        return receiveInstance(result2["instance"], result2["module"]);
      }
      __name(receiveInstantiationResult, "receiveInstantiationResult");
      var info2 = getWasmImports();
      if (Module["instantiateWasm"]) {
        return new Promise((resolve, reject) => {
          Module["instantiateWasm"](info2, (mod, inst) => {
            receiveInstance(mod, inst);
            resolve(mod.exports);
          });
        });
      }
      wasmBinaryFile ??= findWasmBinary();
      try {
        var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info2);
        var exports = receiveInstantiationResult(result);
        return exports;
      } catch (e) {
        readyPromiseReject(e);
        return Promise.reject(e);
      }
    }
    __name(createWasm, "createWasm");
    var ASM_CONSTS = {};
    class ExitStatus {
      static {
        __name(this, "ExitStatus");
      }
      name = "ExitStatus";
      constructor(status) {
        this.message = `Program terminated with exit(${status})`;
        this.status = status;
      }
    }
    var GOT = {};
    var currentModuleWeakSymbols = /* @__PURE__ */ new Set([]);
    var GOTHandler = {
      get(obj, symName) {
        var rtn = GOT[symName];
        if (!rtn) {
          rtn = GOT[symName] = new WebAssembly.Global({
            "value": "i32",
            "mutable": true
          });
        }
        if (!currentModuleWeakSymbols.has(symName)) {
          rtn.required = true;
        }
        return rtn;
      }
    };
    var LE_HEAP_LOAD_F32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getFloat32(byteOffset, true), "LE_HEAP_LOAD_F32");
    var LE_HEAP_LOAD_F64 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getFloat64(byteOffset, true), "LE_HEAP_LOAD_F64");
    var LE_HEAP_LOAD_I16 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getInt16(byteOffset, true), "LE_HEAP_LOAD_I16");
    var LE_HEAP_LOAD_I32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getInt32(byteOffset, true), "LE_HEAP_LOAD_I32");
    var LE_HEAP_LOAD_U16 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getUint16(byteOffset, true), "LE_HEAP_LOAD_U16");
    var LE_HEAP_LOAD_U32 = /* @__PURE__ */ __name((byteOffset) => HEAP_DATA_VIEW.getUint32(byteOffset, true), "LE_HEAP_LOAD_U32");
    var LE_HEAP_STORE_F32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setFloat32(byteOffset, value, true), "LE_HEAP_STORE_F32");
    var LE_HEAP_STORE_F64 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setFloat64(byteOffset, value, true), "LE_HEAP_STORE_F64");
    var LE_HEAP_STORE_I16 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setInt16(byteOffset, value, true), "LE_HEAP_STORE_I16");
    var LE_HEAP_STORE_I32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setInt32(byteOffset, value, true), "LE_HEAP_STORE_I32");
    var LE_HEAP_STORE_U16 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setUint16(byteOffset, value, true), "LE_HEAP_STORE_U16");
    var LE_HEAP_STORE_U32 = /* @__PURE__ */ __name((byteOffset, value) => HEAP_DATA_VIEW.setUint32(byteOffset, value, true), "LE_HEAP_STORE_U32");
    var callRuntimeCallbacks = /* @__PURE__ */ __name((callbacks) => {
      while (callbacks.length > 0) {
        callbacks.shift()(Module);
      }
    }, "callRuntimeCallbacks");
    var onPostRuns = [];
    var addOnPostRun = /* @__PURE__ */ __name((cb) => onPostRuns.unshift(cb), "addOnPostRun");
    var onPreRuns = [];
    var addOnPreRun = /* @__PURE__ */ __name((cb) => onPreRuns.unshift(cb), "addOnPreRun");
    var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder() : void 0;
    var UTF8ArrayToString = /* @__PURE__ */ __name((heapOrArray, idx = 0, maxBytesToRead = NaN) => {
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx;
      while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
      }
      var str = "";
      while (idx < endPtr) {
        var u0 = heapOrArray[idx++];
        if (!(u0 & 128)) {
          str += String.fromCharCode(u0);
          continue;
        }
        var u1 = heapOrArray[idx++] & 63;
        if ((u0 & 224) == 192) {
          str += String.fromCharCode((u0 & 31) << 6 | u1);
          continue;
        }
        var u2 = heapOrArray[idx++] & 63;
        if ((u0 & 240) == 224) {
          u0 = (u0 & 15) << 12 | u1 << 6 | u2;
        } else {
          u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
        }
        if (u0 < 65536) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 65536;
          str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
        }
      }
      return str;
    }, "UTF8ArrayToString");
    var getDylinkMetadata = /* @__PURE__ */ __name((binary2) => {
      var offset = 0;
      var end = 0;
      function getU8() {
        return binary2[offset++];
      }
      __name(getU8, "getU8");
      function getLEB() {
        var ret = 0;
        var mul = 1;
        while (1) {
          var byte = binary2[offset++];
          ret += (byte & 127) * mul;
          mul *= 128;
          if (!(byte & 128)) break;
        }
        return ret;
      }
      __name(getLEB, "getLEB");
      function getString() {
        var len = getLEB();
        offset += len;
        return UTF8ArrayToString(binary2, offset - len, len);
      }
      __name(getString, "getString");
      function failIf(condition, message) {
        if (condition) throw new Error(message);
      }
      __name(failIf, "failIf");
      var name2 = "dylink.0";
      if (binary2 instanceof WebAssembly.Module) {
        var dylinkSection = WebAssembly.Module.customSections(binary2, name2);
        if (dylinkSection.length === 0) {
          name2 = "dylink";
          dylinkSection = WebAssembly.Module.customSections(binary2, name2);
        }
        failIf(dylinkSection.length === 0, "need dylink section");
        binary2 = new Uint8Array(dylinkSection[0]);
        end = binary2.length;
      } else {
        var int32View = new Uint32Array(new Uint8Array(binary2.subarray(0, 24)).buffer);
        var magicNumberFound = int32View[0] == 1836278016 || int32View[0] == 6386541;
        failIf(!magicNumberFound, "need to see wasm magic number");
        failIf(binary2[8] !== 0, "need the dylink section to be first");
        offset = 9;
        var section_size = getLEB();
        end = offset + section_size;
        name2 = getString();
      }
      var customSection = {
        neededDynlibs: [],
        tlsExports: /* @__PURE__ */ new Set(),
        weakImports: /* @__PURE__ */ new Set()
      };
      if (name2 == "dylink") {
        customSection.memorySize = getLEB();
        customSection.memoryAlign = getLEB();
        customSection.tableSize = getLEB();
        customSection.tableAlign = getLEB();
        var neededDynlibsCount = getLEB();
        for (var i2 = 0; i2 < neededDynlibsCount; ++i2) {
          var libname = getString();
          customSection.neededDynlibs.push(libname);
        }
      } else {
        failIf(name2 !== "dylink.0");
        var WASM_DYLINK_MEM_INFO = 1;
        var WASM_DYLINK_NEEDED = 2;
        var WASM_DYLINK_EXPORT_INFO = 3;
        var WASM_DYLINK_IMPORT_INFO = 4;
        var WASM_SYMBOL_TLS = 256;
        var WASM_SYMBOL_BINDING_MASK = 3;
        var WASM_SYMBOL_BINDING_WEAK = 1;
        while (offset < end) {
          var subsectionType = getU8();
          var subsectionSize = getLEB();
          if (subsectionType === WASM_DYLINK_MEM_INFO) {
            customSection.memorySize = getLEB();
            customSection.memoryAlign = getLEB();
            customSection.tableSize = getLEB();
            customSection.tableAlign = getLEB();
          } else if (subsectionType === WASM_DYLINK_NEEDED) {
            var neededDynlibsCount = getLEB();
            for (var i2 = 0; i2 < neededDynlibsCount; ++i2) {
              libname = getString();
              customSection.neededDynlibs.push(libname);
            }
          } else if (subsectionType === WASM_DYLINK_EXPORT_INFO) {
            var count = getLEB();
            while (count--) {
              var symname = getString();
              var flags2 = getLEB();
              if (flags2 & WASM_SYMBOL_TLS) {
                customSection.tlsExports.add(symname);
              }
            }
          } else if (subsectionType === WASM_DYLINK_IMPORT_INFO) {
            var count = getLEB();
            while (count--) {
              var modname = getString();
              var symname = getString();
              var flags2 = getLEB();
              if ((flags2 & WASM_SYMBOL_BINDING_MASK) == WASM_SYMBOL_BINDING_WEAK) {
                customSection.weakImports.add(symname);
              }
            }
          } else {
            offset += subsectionSize;
          }
        }
      }
      return customSection;
    }, "getDylinkMetadata");
    function getValue(ptr, type = "i8") {
      if (type.endsWith("*")) type = "*";
      switch (type) {
        case "i1":
          return HEAP8[ptr];
        case "i8":
          return HEAP8[ptr];
        case "i16":
          return LE_HEAP_LOAD_I16((ptr >> 1) * 2);
        case "i32":
          return LE_HEAP_LOAD_I32((ptr >> 2) * 4);
        case "i64":
          return HEAP64[ptr >> 3];
        case "float":
          return LE_HEAP_LOAD_F32((ptr >> 2) * 4);
        case "double":
          return LE_HEAP_LOAD_F64((ptr >> 3) * 8);
        case "*":
          return LE_HEAP_LOAD_U32((ptr >> 2) * 4);
        default:
          abort(`invalid type for getValue: ${type}`);
      }
    }
    __name(getValue, "getValue");
    var newDSO = /* @__PURE__ */ __name((name2, handle2, syms) => {
      var dso = {
        refcount: Infinity,
        name: name2,
        exports: syms,
        global: true
      };
      LDSO.loadedLibsByName[name2] = dso;
      if (handle2 != void 0) {
        LDSO.loadedLibsByHandle[handle2] = dso;
      }
      return dso;
    }, "newDSO");
    var LDSO = {
      loadedLibsByName: {},
      loadedLibsByHandle: {},
      init() {
        newDSO("__main__", 0, wasmImports);
      }
    };
    var ___heap_base = 78224;
    var alignMemory = /* @__PURE__ */ __name((size, alignment) => Math.ceil(size / alignment) * alignment, "alignMemory");
    var getMemory = /* @__PURE__ */ __name((size) => {
      if (runtimeInitialized) {
        return _calloc(size, 1);
      }
      var ret = ___heap_base;
      var end = ret + alignMemory(size, 16);
      ___heap_base = end;
      GOT["__heap_base"].value = end;
      return ret;
    }, "getMemory");
    var isInternalSym = /* @__PURE__ */ __name((symName) => ["__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm", "__start_em_js", "__stop_em_js"].includes(symName) || symName.startsWith("__em_js__"), "isInternalSym");
    var uleb128Encode = /* @__PURE__ */ __name((n, target) => {
      if (n < 128) {
        target.push(n);
      } else {
        target.push(n % 128 | 128, n >> 7);
      }
    }, "uleb128Encode");
    var sigToWasmTypes = /* @__PURE__ */ __name((sig) => {
      var typeNames = {
        "i": "i32",
        "j": "i64",
        "f": "f32",
        "d": "f64",
        "e": "externref",
        "p": "i32"
      };
      var type = {
        parameters: [],
        results: sig[0] == "v" ? [] : [typeNames[sig[0]]]
      };
      for (var i2 = 1; i2 < sig.length; ++i2) {
        type.parameters.push(typeNames[sig[i2]]);
      }
      return type;
    }, "sigToWasmTypes");
    var generateFuncType = /* @__PURE__ */ __name((sig, target) => {
      var sigRet = sig.slice(0, 1);
      var sigParam = sig.slice(1);
      var typeCodes = {
        "i": 127,
        // i32
        "p": 127,
        // i32
        "j": 126,
        // i64
        "f": 125,
        // f32
        "d": 124,
        // f64
        "e": 111
      };
      target.push(96);
      uleb128Encode(sigParam.length, target);
      for (var i2 = 0; i2 < sigParam.length; ++i2) {
        target.push(typeCodes[sigParam[i2]]);
      }
      if (sigRet == "v") {
        target.push(0);
      } else {
        target.push(1, typeCodes[sigRet]);
      }
    }, "generateFuncType");
    var convertJsFunctionToWasm = /* @__PURE__ */ __name((func2, sig) => {
      if (typeof WebAssembly.Function == "function") {
        return new WebAssembly.Function(sigToWasmTypes(sig), func2);
      }
      var typeSectionBody = [1];
      generateFuncType(sig, typeSectionBody);
      var bytes = [
        0,
        97,
        115,
        109,
        // magic ("\0asm")
        1,
        0,
        0,
        0,
        // version: 1
        1
      ];
      uleb128Encode(typeSectionBody.length, bytes);
      bytes.push(...typeSectionBody);
      bytes.push(
        2,
        7,
        // import section
        // (import "e" "f" (func 0 (type 0)))
        1,
        1,
        101,
        1,
        102,
        0,
        0,
        7,
        5,
        // export section
        // (export "f" (func 0 (type 0)))
        1,
        1,
        102,
        0,
        0
      );
      var module2 = new WebAssembly.Module(new Uint8Array(bytes));
      var instance2 = new WebAssembly.Instance(module2, {
        "e": {
          "f": func2
        }
      });
      var wrappedFunc = instance2.exports["f"];
      return wrappedFunc;
    }, "convertJsFunctionToWasm");
    var wasmTableMirror = [];
    var wasmTable = new WebAssembly.Table({
      "initial": 31,
      "element": "anyfunc"
    });
    var getWasmTableEntry = /* @__PURE__ */ __name((funcPtr) => {
      var func2 = wasmTableMirror[funcPtr];
      if (!func2) {
        if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
        wasmTableMirror[funcPtr] = func2 = wasmTable.get(funcPtr);
      }
      return func2;
    }, "getWasmTableEntry");
    var updateTableMap = /* @__PURE__ */ __name((offset, count) => {
      if (functionsInTableMap) {
        for (var i2 = offset; i2 < offset + count; i2++) {
          var item = getWasmTableEntry(i2);
          if (item) {
            functionsInTableMap.set(item, i2);
          }
        }
      }
    }, "updateTableMap");
    var functionsInTableMap;
    var getFunctionAddress = /* @__PURE__ */ __name((func2) => {
      if (!functionsInTableMap) {
        functionsInTableMap = /* @__PURE__ */ new WeakMap();
        updateTableMap(0, wasmTable.length);
      }
      return functionsInTableMap.get(func2) || 0;
    }, "getFunctionAddress");
    var freeTableIndexes = [];
    var getEmptyTableSlot = /* @__PURE__ */ __name(() => {
      if (freeTableIndexes.length) {
        return freeTableIndexes.pop();
      }
      try {
        wasmTable.grow(1);
      } catch (err2) {
        if (!(err2 instanceof RangeError)) {
          throw err2;
        }
        throw "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.";
      }
      return wasmTable.length - 1;
    }, "getEmptyTableSlot");
    var setWasmTableEntry = /* @__PURE__ */ __name((idx, func2) => {
      wasmTable.set(idx, func2);
      wasmTableMirror[idx] = wasmTable.get(idx);
    }, "setWasmTableEntry");
    var addFunction = /* @__PURE__ */ __name((func2, sig) => {
      var rtn = getFunctionAddress(func2);
      if (rtn) {
        return rtn;
      }
      var ret = getEmptyTableSlot();
      try {
        setWasmTableEntry(ret, func2);
      } catch (err2) {
        if (!(err2 instanceof TypeError)) {
          throw err2;
        }
        var wrapped = convertJsFunctionToWasm(func2, sig);
        setWasmTableEntry(ret, wrapped);
      }
      functionsInTableMap.set(func2, ret);
      return ret;
    }, "addFunction");
    var updateGOT = /* @__PURE__ */ __name((exports, replace) => {
      for (var symName in exports) {
        if (isInternalSym(symName)) {
          continue;
        }
        var value = exports[symName];
        GOT[symName] ||= new WebAssembly.Global({
          "value": "i32",
          "mutable": true
        });
        if (replace || GOT[symName].value == 0) {
          if (typeof value == "function") {
            GOT[symName].value = addFunction(value);
          } else if (typeof value == "number") {
            GOT[symName].value = value;
          } else {
            err(`unhandled export type for '${symName}': ${typeof value}`);
          }
        }
      }
    }, "updateGOT");
    var relocateExports = /* @__PURE__ */ __name((exports, memoryBase2, replace) => {
      var relocated = {};
      for (var e in exports) {
        var value = exports[e];
        if (typeof value == "object") {
          value = value.value;
        }
        if (typeof value == "number") {
          value += memoryBase2;
        }
        relocated[e] = value;
      }
      updateGOT(relocated, replace);
      return relocated;
    }, "relocateExports");
    var isSymbolDefined = /* @__PURE__ */ __name((symName) => {
      var existing = wasmImports[symName];
      if (!existing || existing.stub) {
        return false;
      }
      return true;
    }, "isSymbolDefined");
    var dynCall = /* @__PURE__ */ __name((sig, ptr, args2 = []) => {
      var rtn = getWasmTableEntry(ptr)(...args2);
      return rtn;
    }, "dynCall");
    var stackSave = /* @__PURE__ */ __name(() => _emscripten_stack_get_current(), "stackSave");
    var stackRestore = /* @__PURE__ */ __name((val) => __emscripten_stack_restore(val), "stackRestore");
    var createInvokeFunction = /* @__PURE__ */ __name((sig) => (ptr, ...args2) => {
      var sp = stackSave();
      try {
        return dynCall(sig, ptr, args2);
      } catch (e) {
        stackRestore(sp);
        if (e !== e + 0) throw e;
        _setThrew(1, 0);
        if (sig[0] == "j") return 0n;
      }
    }, "createInvokeFunction");
    var resolveGlobalSymbol = /* @__PURE__ */ __name((symName, direct = false) => {
      var sym;
      if (isSymbolDefined(symName)) {
        sym = wasmImports[symName];
      } else if (symName.startsWith("invoke_")) {
        sym = wasmImports[symName] = createInvokeFunction(symName.split("_")[1]);
      }
      return {
        sym,
        name: symName
      };
    }, "resolveGlobalSymbol");
    var onPostCtors = [];
    var addOnPostCtor = /* @__PURE__ */ __name((cb) => onPostCtors.unshift(cb), "addOnPostCtor");
    var UTF8ToString = /* @__PURE__ */ __name((ptr, maxBytesToRead) => ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "", "UTF8ToString");
    var loadWebAssemblyModule = /* @__PURE__ */ __name((binary, flags, libName, localScope, handle) => {
      var metadata = getDylinkMetadata(binary);
      currentModuleWeakSymbols = metadata.weakImports;
      function loadModule() {
        var memAlign = Math.pow(2, metadata.memoryAlign);
        var memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0;
        var tableBase = metadata.tableSize ? wasmTable.length : 0;
        if (handle) {
          HEAP8[handle + 8] = 1;
          LE_HEAP_STORE_U32((handle + 12 >> 2) * 4, memoryBase);
          LE_HEAP_STORE_I32((handle + 16 >> 2) * 4, metadata.memorySize);
          LE_HEAP_STORE_U32((handle + 20 >> 2) * 4, tableBase);
          LE_HEAP_STORE_I32((handle + 24 >> 2) * 4, metadata.tableSize);
        }
        if (metadata.tableSize) {
          wasmTable.grow(metadata.tableSize);
        }
        var moduleExports;
        function resolveSymbol(sym) {
          var resolved = resolveGlobalSymbol(sym).sym;
          if (!resolved && localScope) {
            resolved = localScope[sym];
          }
          if (!resolved) {
            resolved = moduleExports[sym];
          }
          return resolved;
        }
        __name(resolveSymbol, "resolveSymbol");
        var proxyHandler = {
          get(stubs, prop) {
            switch (prop) {
              case "__memory_base":
                return memoryBase;
              case "__table_base":
                return tableBase;
            }
            if (prop in wasmImports && !wasmImports[prop].stub) {
              var res = wasmImports[prop];
              return res;
            }
            if (!(prop in stubs)) {
              var resolved;
              stubs[prop] = (...args2) => {
                resolved ||= resolveSymbol(prop);
                return resolved(...args2);
              };
            }
            return stubs[prop];
          }
        };
        var proxy = new Proxy({}, proxyHandler);
        var info = {
          "GOT.mem": new Proxy({}, GOTHandler),
          "GOT.func": new Proxy({}, GOTHandler),
          "env": proxy,
          "wasi_snapshot_preview1": proxy
        };
        function postInstantiation(module, instance) {
          updateTableMap(tableBase, metadata.tableSize);
          moduleExports = relocateExports(instance.exports, memoryBase);
          if (!flags.allowUndefined) {
            reportUndefinedSymbols();
          }
          function addEmAsm(addr, body) {
            var args = [];
            var arity = 0;
            for (; arity < 16; arity++) {
              if (body.indexOf("$" + arity) != -1) {
                args.push("$" + arity);
              } else {
                break;
              }
            }
            args = args.join(",");
            var func = `(${args}) => { ${body} };`;
            ASM_CONSTS[start] = eval(func);
          }
          __name(addEmAsm, "addEmAsm");
          if ("__start_em_asm" in moduleExports) {
            var start = moduleExports["__start_em_asm"];
            var stop = moduleExports["__stop_em_asm"];
            while (start < stop) {
              var jsString = UTF8ToString(start);
              addEmAsm(start, jsString);
              start = HEAPU8.indexOf(0, start) + 1;
            }
          }
          function addEmJs(name, cSig, body) {
            var jsArgs = [];
            cSig = cSig.slice(1, -1);
            if (cSig != "void") {
              cSig = cSig.split(",");
              for (var i in cSig) {
                var jsArg = cSig[i].split(" ").pop();
                jsArgs.push(jsArg.replace("*", ""));
              }
            }
            var func = `(${jsArgs}) => ${body};`;
            moduleExports[name] = eval(func);
          }
          __name(addEmJs, "addEmJs");
          for (var name in moduleExports) {
            if (name.startsWith("__em_js__")) {
              var start = moduleExports[name];
              var jsString = UTF8ToString(start);
              var parts = jsString.split("<::>");
              addEmJs(name.replace("__em_js__", ""), parts[0], parts[1]);
              delete moduleExports[name];
            }
          }
          var applyRelocs = moduleExports["__wasm_apply_data_relocs"];
          if (applyRelocs) {
            if (runtimeInitialized) {
              applyRelocs();
            } else {
              __RELOC_FUNCS__.push(applyRelocs);
            }
          }
          var init = moduleExports["__wasm_call_ctors"];
          if (init) {
            if (runtimeInitialized) {
              init();
            } else {
              addOnPostCtor(init);
            }
          }
          return moduleExports;
        }
        __name(postInstantiation, "postInstantiation");
        if (flags.loadAsync) {
          if (binary instanceof WebAssembly.Module) {
            var instance = new WebAssembly.Instance(binary, info);
            return Promise.resolve(postInstantiation(binary, instance));
          }
          return WebAssembly.instantiate(binary, info).then((result) => postInstantiation(result.module, result.instance));
        }
        var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary);
        var instance = new WebAssembly.Instance(module, info);
        return postInstantiation(module, instance);
      }
      __name(loadModule, "loadModule");
      if (flags.loadAsync) {
        return metadata.neededDynlibs.reduce((chain2, dynNeeded) => chain2.then(() => loadDynamicLibrary(dynNeeded, flags, localScope)), Promise.resolve()).then(loadModule);
      }
      metadata.neededDynlibs.forEach((needed) => loadDynamicLibrary(needed, flags, localScope));
      return loadModule();
    }, "loadWebAssemblyModule");
    var mergeLibSymbols = /* @__PURE__ */ __name((exports, libName2) => {
      for (var [sym, exp] of Object.entries(exports)) {
        const setImport = /* @__PURE__ */ __name((target) => {
          if (!isSymbolDefined(target)) {
            wasmImports[target] = exp;
          }
        }, "setImport");
        setImport(sym);
        const main_alias = "__main_argc_argv";
        if (sym == "main") {
          setImport(main_alias);
        }
        if (sym == main_alias) {
          setImport("main");
        }
      }
    }, "mergeLibSymbols");
    var asyncLoad = /* @__PURE__ */ __name(async (url) => {
      var arrayBuffer = await readAsync(url);
      return new Uint8Array(arrayBuffer);
    }, "asyncLoad");
    function loadDynamicLibrary(libName2, flags2 = {
      global: true,
      nodelete: true
    }, localScope2, handle2) {
      var dso = LDSO.loadedLibsByName[libName2];
      if (dso) {
        if (!flags2.global) {
          if (localScope2) {
            Object.assign(localScope2, dso.exports);
          }
        } else if (!dso.global) {
          dso.global = true;
          mergeLibSymbols(dso.exports, libName2);
        }
        if (flags2.nodelete && dso.refcount !== Infinity) {
          dso.refcount = Infinity;
        }
        dso.refcount++;
        if (handle2) {
          LDSO.loadedLibsByHandle[handle2] = dso;
        }
        return flags2.loadAsync ? Promise.resolve(true) : true;
      }
      dso = newDSO(libName2, handle2, "loading");
      dso.refcount = flags2.nodelete ? Infinity : 1;
      dso.global = flags2.global;
      function loadLibData() {
        if (handle2) {
          var data = LE_HEAP_LOAD_U32((handle2 + 28 >> 2) * 4);
          var dataSize = LE_HEAP_LOAD_U32((handle2 + 32 >> 2) * 4);
          if (data && dataSize) {
            var libData = HEAP8.slice(data, data + dataSize);
            return flags2.loadAsync ? Promise.resolve(libData) : libData;
          }
        }
        var libFile = locateFile(libName2);
        if (flags2.loadAsync) {
          return asyncLoad(libFile);
        }
        if (!readBinary) {
          throw new Error(`${libFile}: file not found, and synchronous loading of external files is not available`);
        }
        return readBinary(libFile);
      }
      __name(loadLibData, "loadLibData");
      function getExports() {
        if (flags2.loadAsync) {
          return loadLibData().then((libData) => loadWebAssemblyModule(libData, flags2, libName2, localScope2, handle2));
        }
        return loadWebAssemblyModule(loadLibData(), flags2, libName2, localScope2, handle2);
      }
      __name(getExports, "getExports");
      function moduleLoaded(exports) {
        if (dso.global) {
          mergeLibSymbols(exports, libName2);
        } else if (localScope2) {
          Object.assign(localScope2, exports);
        }
        dso.exports = exports;
      }
      __name(moduleLoaded, "moduleLoaded");
      if (flags2.loadAsync) {
        return getExports().then((exports) => {
          moduleLoaded(exports);
          return true;
        });
      }
      moduleLoaded(getExports());
      return true;
    }
    __name(loadDynamicLibrary, "loadDynamicLibrary");
    var reportUndefinedSymbols = /* @__PURE__ */ __name(() => {
      for (var [symName, entry] of Object.entries(GOT)) {
        if (entry.value == 0) {
          var value = resolveGlobalSymbol(symName, true).sym;
          if (!value && !entry.required) {
            continue;
          }
          if (typeof value == "function") {
            entry.value = addFunction(value, value.sig);
          } else if (typeof value == "number") {
            entry.value = value;
          } else {
            throw new Error(`bad export type for '${symName}': ${typeof value}`);
          }
        }
      }
    }, "reportUndefinedSymbols");
    var loadDylibs = /* @__PURE__ */ __name(() => {
      if (!dynamicLibraries.length) {
        reportUndefinedSymbols();
        return;
      }
      addRunDependency("loadDylibs");
      dynamicLibraries.reduce((chain2, lib) => chain2.then(() => loadDynamicLibrary(lib, {
        loadAsync: true,
        global: true,
        nodelete: true,
        allowUndefined: true
      })), Promise.resolve()).then(() => {
        reportUndefinedSymbols();
        removeRunDependency("loadDylibs");
      });
    }, "loadDylibs");
    var noExitRuntime = Module["noExitRuntime"] || true;
    function setValue(ptr, value, type = "i8") {
      if (type.endsWith("*")) type = "*";
      switch (type) {
        case "i1":
          HEAP8[ptr] = value;
          break;
        case "i8":
          HEAP8[ptr] = value;
          break;
        case "i16":
          LE_HEAP_STORE_I16((ptr >> 1) * 2, value);
          break;
        case "i32":
          LE_HEAP_STORE_I32((ptr >> 2) * 4, value);
          break;
        case "i64":
          HEAP64[ptr >> 3] = BigInt(value);
          break;
        case "float":
          LE_HEAP_STORE_F32((ptr >> 2) * 4, value);
          break;
        case "double":
          LE_HEAP_STORE_F64((ptr >> 3) * 8, value);
          break;
        case "*":
          LE_HEAP_STORE_U32((ptr >> 2) * 4, value);
          break;
        default:
          abort(`invalid type for setValue: ${type}`);
      }
    }
    __name(setValue, "setValue");
    var ___memory_base = new WebAssembly.Global({
      "value": "i32",
      "mutable": false
    }, 1024);
    var ___stack_pointer = new WebAssembly.Global({
      "value": "i32",
      "mutable": true
    }, 78224);
    var ___table_base = new WebAssembly.Global({
      "value": "i32",
      "mutable": false
    }, 1);
    var __abort_js = /* @__PURE__ */ __name(() => abort(""), "__abort_js");
    __abort_js.sig = "v";
    var _emscripten_get_now = /* @__PURE__ */ __name(() => performance.now(), "_emscripten_get_now");
    _emscripten_get_now.sig = "d";
    var _emscripten_date_now = /* @__PURE__ */ __name(() => Date.now(), "_emscripten_date_now");
    _emscripten_date_now.sig = "d";
    var nowIsMonotonic = 1;
    var checkWasiClock = /* @__PURE__ */ __name((clock_id) => clock_id >= 0 && clock_id <= 3, "checkWasiClock");
    var INT53_MAX = 9007199254740992;
    var INT53_MIN = -9007199254740992;
    var bigintToI53Checked = /* @__PURE__ */ __name((num) => num < INT53_MIN || num > INT53_MAX ? NaN : Number(num), "bigintToI53Checked");
    function _clock_time_get(clk_id, ignored_precision, ptime) {
      ignored_precision = bigintToI53Checked(ignored_precision);
      if (!checkWasiClock(clk_id)) {
        return 28;
      }
      var now;
      if (clk_id === 0) {
        now = _emscripten_date_now();
      } else if (nowIsMonotonic) {
        now = _emscripten_get_now();
      } else {
        return 52;
      }
      var nsec = Math.round(now * 1e3 * 1e3);
      HEAP64[ptime >> 3] = BigInt(nsec);
      return 0;
    }
    __name(_clock_time_get, "_clock_time_get");
    _clock_time_get.sig = "iijp";
    var getHeapMax = /* @__PURE__ */ __name(() => (
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648
    ), "getHeapMax");
    var growMemory = /* @__PURE__ */ __name((size) => {
      var b = wasmMemory.buffer;
      var pages = (size - b.byteLength + 65535) / 65536 | 0;
      try {
        wasmMemory.grow(pages);
        updateMemoryViews();
        return 1;
      } catch (e) {
      }
    }, "growMemory");
    var _emscripten_resize_heap = /* @__PURE__ */ __name((requestedSize) => {
      var oldSize = HEAPU8.length;
      requestedSize >>>= 0;
      var maxHeapSize = getHeapMax();
      if (requestedSize > maxHeapSize) {
        return false;
      }
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
        var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
        var replacement = growMemory(newSize);
        if (replacement) {
          return true;
        }
      }
      return false;
    }, "_emscripten_resize_heap");
    _emscripten_resize_heap.sig = "ip";
    var _fd_close = /* @__PURE__ */ __name((fd) => 52, "_fd_close");
    _fd_close.sig = "ii";
    function _fd_seek(fd, offset, whence, newOffset) {
      offset = bigintToI53Checked(offset);
      return 70;
    }
    __name(_fd_seek, "_fd_seek");
    _fd_seek.sig = "iijip";
    var printCharBuffers = [null, [], []];
    var printChar = /* @__PURE__ */ __name((stream, curr) => {
      var buffer = printCharBuffers[stream];
      if (curr === 0 || curr === 10) {
        (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
        buffer.length = 0;
      } else {
        buffer.push(curr);
      }
    }, "printChar");
    var flush_NO_FILESYSTEM = /* @__PURE__ */ __name(() => {
      if (printCharBuffers[1].length) printChar(1, 10);
      if (printCharBuffers[2].length) printChar(2, 10);
    }, "flush_NO_FILESYSTEM");
    var SYSCALLS = {
      varargs: void 0,
      getStr(ptr) {
        var ret = UTF8ToString(ptr);
        return ret;
      }
    };
    var _fd_write = /* @__PURE__ */ __name((fd, iov, iovcnt, pnum) => {
      var num = 0;
      for (var i2 = 0; i2 < iovcnt; i2++) {
        var ptr = LE_HEAP_LOAD_U32((iov >> 2) * 4);
        var len = LE_HEAP_LOAD_U32((iov + 4 >> 2) * 4);
        iov += 8;
        for (var j = 0; j < len; j++) {
          printChar(fd, HEAPU8[ptr + j]);
        }
        num += len;
      }
      LE_HEAP_STORE_U32((pnum >> 2) * 4, num);
      return 0;
    }, "_fd_write");
    _fd_write.sig = "iippp";
    function _tree_sitter_log_callback(isLexMessage, messageAddress) {
      if (Module.currentLogCallback) {
        const message = UTF8ToString(messageAddress);
        Module.currentLogCallback(message, isLexMessage !== 0);
      }
    }
    __name(_tree_sitter_log_callback, "_tree_sitter_log_callback");
    function _tree_sitter_parse_callback(inputBufferAddress, index, row, column, lengthAddress) {
      const INPUT_BUFFER_SIZE = 10 * 1024;
      const string = Module.currentParseCallback(index, {
        row,
        column
      });
      if (typeof string === "string") {
        setValue(lengthAddress, string.length, "i32");
        stringToUTF16(string, inputBufferAddress, INPUT_BUFFER_SIZE);
      } else {
        setValue(lengthAddress, 0, "i32");
      }
    }
    __name(_tree_sitter_parse_callback, "_tree_sitter_parse_callback");
    function _tree_sitter_progress_callback(currentOffset, hasError) {
      if (Module.currentProgressCallback) {
        return Module.currentProgressCallback({
          currentOffset,
          hasError
        });
      }
      return false;
    }
    __name(_tree_sitter_progress_callback, "_tree_sitter_progress_callback");
    function _tree_sitter_query_progress_callback(currentOffset) {
      if (Module.currentQueryProgressCallback) {
        return Module.currentQueryProgressCallback({
          currentOffset
        });
      }
      return false;
    }
    __name(_tree_sitter_query_progress_callback, "_tree_sitter_query_progress_callback");
    var runtimeKeepaliveCounter = 0;
    var keepRuntimeAlive = /* @__PURE__ */ __name(() => noExitRuntime || runtimeKeepaliveCounter > 0, "keepRuntimeAlive");
    var _proc_exit = /* @__PURE__ */ __name((code) => {
      EXITSTATUS = code;
      if (!keepRuntimeAlive()) {
        Module["onExit"]?.(code);
        ABORT = true;
      }
      quit_(code, new ExitStatus(code));
    }, "_proc_exit");
    _proc_exit.sig = "vi";
    var exitJS = /* @__PURE__ */ __name((status, implicit) => {
      EXITSTATUS = status;
      _proc_exit(status);
    }, "exitJS");
    var handleException = /* @__PURE__ */ __name((e) => {
      if (e instanceof ExitStatus || e == "unwind") {
        return EXITSTATUS;
      }
      quit_(1, e);
    }, "handleException");
    var lengthBytesUTF8 = /* @__PURE__ */ __name((str) => {
      var len = 0;
      for (var i2 = 0; i2 < str.length; ++i2) {
        var c = str.charCodeAt(i2);
        if (c <= 127) {
          len++;
        } else if (c <= 2047) {
          len += 2;
        } else if (c >= 55296 && c <= 57343) {
          len += 4;
          ++i2;
        } else {
          len += 3;
        }
      }
      return len;
    }, "lengthBytesUTF8");
    var stringToUTF8Array = /* @__PURE__ */ __name((str, heap, outIdx, maxBytesToWrite) => {
      if (!(maxBytesToWrite > 0)) return 0;
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1;
      for (var i2 = 0; i2 < str.length; ++i2) {
        var u = str.charCodeAt(i2);
        if (u >= 55296 && u <= 57343) {
          var u1 = str.charCodeAt(++i2);
          u = 65536 + ((u & 1023) << 10) | u1 & 1023;
        }
        if (u <= 127) {
          if (outIdx >= endIdx) break;
          heap[outIdx++] = u;
        } else if (u <= 2047) {
          if (outIdx + 1 >= endIdx) break;
          heap[outIdx++] = 192 | u >> 6;
          heap[outIdx++] = 128 | u & 63;
        } else if (u <= 65535) {
          if (outIdx + 2 >= endIdx) break;
          heap[outIdx++] = 224 | u >> 12;
          heap[outIdx++] = 128 | u >> 6 & 63;
          heap[outIdx++] = 128 | u & 63;
        } else {
          if (outIdx + 3 >= endIdx) break;
          heap[outIdx++] = 240 | u >> 18;
          heap[outIdx++] = 128 | u >> 12 & 63;
          heap[outIdx++] = 128 | u >> 6 & 63;
          heap[outIdx++] = 128 | u & 63;
        }
      }
      heap[outIdx] = 0;
      return outIdx - startIdx;
    }, "stringToUTF8Array");
    var stringToUTF8 = /* @__PURE__ */ __name((str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite), "stringToUTF8");
    var stackAlloc = /* @__PURE__ */ __name((sz) => __emscripten_stack_alloc(sz), "stackAlloc");
    var stringToUTF8OnStack = /* @__PURE__ */ __name((str) => {
      var size = lengthBytesUTF8(str) + 1;
      var ret = stackAlloc(size);
      stringToUTF8(str, ret, size);
      return ret;
    }, "stringToUTF8OnStack");
    var AsciiToString = /* @__PURE__ */ __name((ptr) => {
      var str = "";
      while (1) {
        var ch = HEAPU8[ptr++];
        if (!ch) return str;
        str += String.fromCharCode(ch);
      }
    }, "AsciiToString");
    var stringToUTF16 = /* @__PURE__ */ __name((str, outPtr, maxBytesToWrite) => {
      maxBytesToWrite ??= 2147483647;
      if (maxBytesToWrite < 2) return 0;
      maxBytesToWrite -= 2;
      var startPtr = outPtr;
      var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
      for (var i2 = 0; i2 < numCharsToWrite; ++i2) {
        var codeUnit = str.charCodeAt(i2);
        LE_HEAP_STORE_I16((outPtr >> 1) * 2, codeUnit);
        outPtr += 2;
      }
      LE_HEAP_STORE_I16((outPtr >> 1) * 2, 0);
      return outPtr - startPtr;
    }, "stringToUTF16");
    var wasmImports = {
      /** @export */
      __heap_base: ___heap_base,
      /** @export */
      __indirect_function_table: wasmTable,
      /** @export */
      __memory_base: ___memory_base,
      /** @export */
      __stack_pointer: ___stack_pointer,
      /** @export */
      __table_base: ___table_base,
      /** @export */
      _abort_js: __abort_js,
      /** @export */
      clock_time_get: _clock_time_get,
      /** @export */
      emscripten_resize_heap: _emscripten_resize_heap,
      /** @export */
      fd_close: _fd_close,
      /** @export */
      fd_seek: _fd_seek,
      /** @export */
      fd_write: _fd_write,
      /** @export */
      memory: wasmMemory,
      /** @export */
      tree_sitter_log_callback: _tree_sitter_log_callback,
      /** @export */
      tree_sitter_parse_callback: _tree_sitter_parse_callback,
      /** @export */
      tree_sitter_progress_callback: _tree_sitter_progress_callback,
      /** @export */
      tree_sitter_query_progress_callback: _tree_sitter_query_progress_callback
    };
    var wasmExports = await createWasm();
    var ___wasm_call_ctors = wasmExports["__wasm_call_ctors"];
    var _malloc = Module["_malloc"] = wasmExports["malloc"];
    var _calloc = Module["_calloc"] = wasmExports["calloc"];
    var _realloc = Module["_realloc"] = wasmExports["realloc"];
    var _free = Module["_free"] = wasmExports["free"];
    var _memcmp = Module["_memcmp"] = wasmExports["memcmp"];
    var _ts_language_symbol_count = Module["_ts_language_symbol_count"] = wasmExports["ts_language_symbol_count"];
    var _ts_language_state_count = Module["_ts_language_state_count"] = wasmExports["ts_language_state_count"];
    var _ts_language_version = Module["_ts_language_version"] = wasmExports["ts_language_version"];
    var _ts_language_abi_version = Module["_ts_language_abi_version"] = wasmExports["ts_language_abi_version"];
    var _ts_language_metadata = Module["_ts_language_metadata"] = wasmExports["ts_language_metadata"];
    var _ts_language_name = Module["_ts_language_name"] = wasmExports["ts_language_name"];
    var _ts_language_field_count = Module["_ts_language_field_count"] = wasmExports["ts_language_field_count"];
    var _ts_language_next_state = Module["_ts_language_next_state"] = wasmExports["ts_language_next_state"];
    var _ts_language_symbol_name = Module["_ts_language_symbol_name"] = wasmExports["ts_language_symbol_name"];
    var _ts_language_symbol_for_name = Module["_ts_language_symbol_for_name"] = wasmExports["ts_language_symbol_for_name"];
    var _strncmp = Module["_strncmp"] = wasmExports["strncmp"];
    var _ts_language_symbol_type = Module["_ts_language_symbol_type"] = wasmExports["ts_language_symbol_type"];
    var _ts_language_field_name_for_id = Module["_ts_language_field_name_for_id"] = wasmExports["ts_language_field_name_for_id"];
    var _ts_lookahead_iterator_new = Module["_ts_lookahead_iterator_new"] = wasmExports["ts_lookahead_iterator_new"];
    var _ts_lookahead_iterator_delete = Module["_ts_lookahead_iterator_delete"] = wasmExports["ts_lookahead_iterator_delete"];
    var _ts_lookahead_iterator_reset_state = Module["_ts_lookahead_iterator_reset_state"] = wasmExports["ts_lookahead_iterator_reset_state"];
    var _ts_lookahead_iterator_reset = Module["_ts_lookahead_iterator_reset"] = wasmExports["ts_lookahead_iterator_reset"];
    var _ts_lookahead_iterator_next = Module["_ts_lookahead_iterator_next"] = wasmExports["ts_lookahead_iterator_next"];
    var _ts_lookahead_iterator_current_symbol = Module["_ts_lookahead_iterator_current_symbol"] = wasmExports["ts_lookahead_iterator_current_symbol"];
    var _ts_parser_delete = Module["_ts_parser_delete"] = wasmExports["ts_parser_delete"];
    var _ts_parser_reset = Module["_ts_parser_reset"] = wasmExports["ts_parser_reset"];
    var _ts_parser_set_language = Module["_ts_parser_set_language"] = wasmExports["ts_parser_set_language"];
    var _ts_parser_timeout_micros = Module["_ts_parser_timeout_micros"] = wasmExports["ts_parser_timeout_micros"];
    var _ts_parser_set_timeout_micros = Module["_ts_parser_set_timeout_micros"] = wasmExports["ts_parser_set_timeout_micros"];
    var _ts_parser_set_included_ranges = Module["_ts_parser_set_included_ranges"] = wasmExports["ts_parser_set_included_ranges"];
    var _ts_query_new = Module["_ts_query_new"] = wasmExports["ts_query_new"];
    var _ts_query_delete = Module["_ts_query_delete"] = wasmExports["ts_query_delete"];
    var _iswspace = Module["_iswspace"] = wasmExports["iswspace"];
    var _iswalnum = Module["_iswalnum"] = wasmExports["iswalnum"];
    var _ts_query_pattern_count = Module["_ts_query_pattern_count"] = wasmExports["ts_query_pattern_count"];
    var _ts_query_capture_count = Module["_ts_query_capture_count"] = wasmExports["ts_query_capture_count"];
    var _ts_query_string_count = Module["_ts_query_string_count"] = wasmExports["ts_query_string_count"];
    var _ts_query_capture_name_for_id = Module["_ts_query_capture_name_for_id"] = wasmExports["ts_query_capture_name_for_id"];
    var _ts_query_capture_quantifier_for_id = Module["_ts_query_capture_quantifier_for_id"] = wasmExports["ts_query_capture_quantifier_for_id"];
    var _ts_query_string_value_for_id = Module["_ts_query_string_value_for_id"] = wasmExports["ts_query_string_value_for_id"];
    var _ts_query_predicates_for_pattern = Module["_ts_query_predicates_for_pattern"] = wasmExports["ts_query_predicates_for_pattern"];
    var _ts_query_start_byte_for_pattern = Module["_ts_query_start_byte_for_pattern"] = wasmExports["ts_query_start_byte_for_pattern"];
    var _ts_query_end_byte_for_pattern = Module["_ts_query_end_byte_for_pattern"] = wasmExports["ts_query_end_byte_for_pattern"];
    var _ts_query_is_pattern_rooted = Module["_ts_query_is_pattern_rooted"] = wasmExports["ts_query_is_pattern_rooted"];
    var _ts_query_is_pattern_non_local = Module["_ts_query_is_pattern_non_local"] = wasmExports["ts_query_is_pattern_non_local"];
    var _ts_query_is_pattern_guaranteed_at_step = Module["_ts_query_is_pattern_guaranteed_at_step"] = wasmExports["ts_query_is_pattern_guaranteed_at_step"];
    var _ts_query_disable_capture = Module["_ts_query_disable_capture"] = wasmExports["ts_query_disable_capture"];
    var _ts_query_disable_pattern = Module["_ts_query_disable_pattern"] = wasmExports["ts_query_disable_pattern"];
    var _ts_tree_copy = Module["_ts_tree_copy"] = wasmExports["ts_tree_copy"];
    var _ts_tree_delete = Module["_ts_tree_delete"] = wasmExports["ts_tree_delete"];
    var _ts_init = Module["_ts_init"] = wasmExports["ts_init"];
    var _ts_parser_new_wasm = Module["_ts_parser_new_wasm"] = wasmExports["ts_parser_new_wasm"];
    var _ts_parser_enable_logger_wasm = Module["_ts_parser_enable_logger_wasm"] = wasmExports["ts_parser_enable_logger_wasm"];
    var _ts_parser_parse_wasm = Module["_ts_parser_parse_wasm"] = wasmExports["ts_parser_parse_wasm"];
    var _ts_parser_included_ranges_wasm = Module["_ts_parser_included_ranges_wasm"] = wasmExports["ts_parser_included_ranges_wasm"];
    var _ts_language_type_is_named_wasm = Module["_ts_language_type_is_named_wasm"] = wasmExports["ts_language_type_is_named_wasm"];
    var _ts_language_type_is_visible_wasm = Module["_ts_language_type_is_visible_wasm"] = wasmExports["ts_language_type_is_visible_wasm"];
    var _ts_language_supertypes_wasm = Module["_ts_language_supertypes_wasm"] = wasmExports["ts_language_supertypes_wasm"];
    var _ts_language_subtypes_wasm = Module["_ts_language_subtypes_wasm"] = wasmExports["ts_language_subtypes_wasm"];
    var _ts_tree_root_node_wasm = Module["_ts_tree_root_node_wasm"] = wasmExports["ts_tree_root_node_wasm"];
    var _ts_tree_root_node_with_offset_wasm = Module["_ts_tree_root_node_with_offset_wasm"] = wasmExports["ts_tree_root_node_with_offset_wasm"];
    var _ts_tree_edit_wasm = Module["_ts_tree_edit_wasm"] = wasmExports["ts_tree_edit_wasm"];
    var _ts_tree_included_ranges_wasm = Module["_ts_tree_included_ranges_wasm"] = wasmExports["ts_tree_included_ranges_wasm"];
    var _ts_tree_get_changed_ranges_wasm = Module["_ts_tree_get_changed_ranges_wasm"] = wasmExports["ts_tree_get_changed_ranges_wasm"];
    var _ts_tree_cursor_new_wasm = Module["_ts_tree_cursor_new_wasm"] = wasmExports["ts_tree_cursor_new_wasm"];
    var _ts_tree_cursor_copy_wasm = Module["_ts_tree_cursor_copy_wasm"] = wasmExports["ts_tree_cursor_copy_wasm"];
    var _ts_tree_cursor_delete_wasm = Module["_ts_tree_cursor_delete_wasm"] = wasmExports["ts_tree_cursor_delete_wasm"];
    var _ts_tree_cursor_reset_wasm = Module["_ts_tree_cursor_reset_wasm"] = wasmExports["ts_tree_cursor_reset_wasm"];
    var _ts_tree_cursor_reset_to_wasm = Module["_ts_tree_cursor_reset_to_wasm"] = wasmExports["ts_tree_cursor_reset_to_wasm"];
    var _ts_tree_cursor_goto_first_child_wasm = Module["_ts_tree_cursor_goto_first_child_wasm"] = wasmExports["ts_tree_cursor_goto_first_child_wasm"];
    var _ts_tree_cursor_goto_last_child_wasm = Module["_ts_tree_cursor_goto_last_child_wasm"] = wasmExports["ts_tree_cursor_goto_last_child_wasm"];
    var _ts_tree_cursor_goto_first_child_for_index_wasm = Module["_ts_tree_cursor_goto_first_child_for_index_wasm"] = wasmExports["ts_tree_cursor_goto_first_child_for_index_wasm"];
    var _ts_tree_cursor_goto_first_child_for_position_wasm = Module["_ts_tree_cursor_goto_first_child_for_position_wasm"] = wasmExports["ts_tree_cursor_goto_first_child_for_position_wasm"];
    var _ts_tree_cursor_goto_next_sibling_wasm = Module["_ts_tree_cursor_goto_next_sibling_wasm"] = wasmExports["ts_tree_cursor_goto_next_sibling_wasm"];
    var _ts_tree_cursor_goto_previous_sibling_wasm = Module["_ts_tree_cursor_goto_previous_sibling_wasm"] = wasmExports["ts_tree_cursor_goto_previous_sibling_wasm"];
    var _ts_tree_cursor_goto_descendant_wasm = Module["_ts_tree_cursor_goto_descendant_wasm"] = wasmExports["ts_tree_cursor_goto_descendant_wasm"];
    var _ts_tree_cursor_goto_parent_wasm = Module["_ts_tree_cursor_goto_parent_wasm"] = wasmExports["ts_tree_cursor_goto_parent_wasm"];
    var _ts_tree_cursor_current_node_type_id_wasm = Module["_ts_tree_cursor_current_node_type_id_wasm"] = wasmExports["ts_tree_cursor_current_node_type_id_wasm"];
    var _ts_tree_cursor_current_node_state_id_wasm = Module["_ts_tree_cursor_current_node_state_id_wasm"] = wasmExports["ts_tree_cursor_current_node_state_id_wasm"];
    var _ts_tree_cursor_current_node_is_named_wasm = Module["_ts_tree_cursor_current_node_is_named_wasm"] = wasmExports["ts_tree_cursor_current_node_is_named_wasm"];
    var _ts_tree_cursor_current_node_is_missing_wasm = Module["_ts_tree_cursor_current_node_is_missing_wasm"] = wasmExports["ts_tree_cursor_current_node_is_missing_wasm"];
    var _ts_tree_cursor_current_node_id_wasm = Module["_ts_tree_cursor_current_node_id_wasm"] = wasmExports["ts_tree_cursor_current_node_id_wasm"];
    var _ts_tree_cursor_start_position_wasm = Module["_ts_tree_cursor_start_position_wasm"] = wasmExports["ts_tree_cursor_start_position_wasm"];
    var _ts_tree_cursor_end_position_wasm = Module["_ts_tree_cursor_end_position_wasm"] = wasmExports["ts_tree_cursor_end_position_wasm"];
    var _ts_tree_cursor_start_index_wasm = Module["_ts_tree_cursor_start_index_wasm"] = wasmExports["ts_tree_cursor_start_index_wasm"];
    var _ts_tree_cursor_end_index_wasm = Module["_ts_tree_cursor_end_index_wasm"] = wasmExports["ts_tree_cursor_end_index_wasm"];
    var _ts_tree_cursor_current_field_id_wasm = Module["_ts_tree_cursor_current_field_id_wasm"] = wasmExports["ts_tree_cursor_current_field_id_wasm"];
    var _ts_tree_cursor_current_depth_wasm = Module["_ts_tree_cursor_current_depth_wasm"] = wasmExports["ts_tree_cursor_current_depth_wasm"];
    var _ts_tree_cursor_current_descendant_index_wasm = Module["_ts_tree_cursor_current_descendant_index_wasm"] = wasmExports["ts_tree_cursor_current_descendant_index_wasm"];
    var _ts_tree_cursor_current_node_wasm = Module["_ts_tree_cursor_current_node_wasm"] = wasmExports["ts_tree_cursor_current_node_wasm"];
    var _ts_node_symbol_wasm = Module["_ts_node_symbol_wasm"] = wasmExports["ts_node_symbol_wasm"];
    var _ts_node_field_name_for_child_wasm = Module["_ts_node_field_name_for_child_wasm"] = wasmExports["ts_node_field_name_for_child_wasm"];
    var _ts_node_field_name_for_named_child_wasm = Module["_ts_node_field_name_for_named_child_wasm"] = wasmExports["ts_node_field_name_for_named_child_wasm"];
    var _ts_node_children_by_field_id_wasm = Module["_ts_node_children_by_field_id_wasm"] = wasmExports["ts_node_children_by_field_id_wasm"];
    var _ts_node_first_child_for_byte_wasm = Module["_ts_node_first_child_for_byte_wasm"] = wasmExports["ts_node_first_child_for_byte_wasm"];
    var _ts_node_first_named_child_for_byte_wasm = Module["_ts_node_first_named_child_for_byte_wasm"] = wasmExports["ts_node_first_named_child_for_byte_wasm"];
    var _ts_node_grammar_symbol_wasm = Module["_ts_node_grammar_symbol_wasm"] = wasmExports["ts_node_grammar_symbol_wasm"];
    var _ts_node_child_count_wasm = Module["_ts_node_child_count_wasm"] = wasmExports["ts_node_child_count_wasm"];
    var _ts_node_named_child_count_wasm = Module["_ts_node_named_child_count_wasm"] = wasmExports["ts_node_named_child_count_wasm"];
    var _ts_node_child_wasm = Module["_ts_node_child_wasm"] = wasmExports["ts_node_child_wasm"];
    var _ts_node_named_child_wasm = Module["_ts_node_named_child_wasm"] = wasmExports["ts_node_named_child_wasm"];
    var _ts_node_child_by_field_id_wasm = Module["_ts_node_child_by_field_id_wasm"] = wasmExports["ts_node_child_by_field_id_wasm"];
    var _ts_node_next_sibling_wasm = Module["_ts_node_next_sibling_wasm"] = wasmExports["ts_node_next_sibling_wasm"];
    var _ts_node_prev_sibling_wasm = Module["_ts_node_prev_sibling_wasm"] = wasmExports["ts_node_prev_sibling_wasm"];
    var _ts_node_next_named_sibling_wasm = Module["_ts_node_next_named_sibling_wasm"] = wasmExports["ts_node_next_named_sibling_wasm"];
    var _ts_node_prev_named_sibling_wasm = Module["_ts_node_prev_named_sibling_wasm"] = wasmExports["ts_node_prev_named_sibling_wasm"];
    var _ts_node_descendant_count_wasm = Module["_ts_node_descendant_count_wasm"] = wasmExports["ts_node_descendant_count_wasm"];
    var _ts_node_parent_wasm = Module["_ts_node_parent_wasm"] = wasmExports["ts_node_parent_wasm"];
    var _ts_node_child_with_descendant_wasm = Module["_ts_node_child_with_descendant_wasm"] = wasmExports["ts_node_child_with_descendant_wasm"];
    var _ts_node_descendant_for_index_wasm = Module["_ts_node_descendant_for_index_wasm"] = wasmExports["ts_node_descendant_for_index_wasm"];
    var _ts_node_named_descendant_for_index_wasm = Module["_ts_node_named_descendant_for_index_wasm"] = wasmExports["ts_node_named_descendant_for_index_wasm"];
    var _ts_node_descendant_for_position_wasm = Module["_ts_node_descendant_for_position_wasm"] = wasmExports["ts_node_descendant_for_position_wasm"];
    var _ts_node_named_descendant_for_position_wasm = Module["_ts_node_named_descendant_for_position_wasm"] = wasmExports["ts_node_named_descendant_for_position_wasm"];
    var _ts_node_start_point_wasm = Module["_ts_node_start_point_wasm"] = wasmExports["ts_node_start_point_wasm"];
    var _ts_node_end_point_wasm = Module["_ts_node_end_point_wasm"] = wasmExports["ts_node_end_point_wasm"];
    var _ts_node_start_index_wasm = Module["_ts_node_start_index_wasm"] = wasmExports["ts_node_start_index_wasm"];
    var _ts_node_end_index_wasm = Module["_ts_node_end_index_wasm"] = wasmExports["ts_node_end_index_wasm"];
    var _ts_node_to_string_wasm = Module["_ts_node_to_string_wasm"] = wasmExports["ts_node_to_string_wasm"];
    var _ts_node_children_wasm = Module["_ts_node_children_wasm"] = wasmExports["ts_node_children_wasm"];
    var _ts_node_named_children_wasm = Module["_ts_node_named_children_wasm"] = wasmExports["ts_node_named_children_wasm"];
    var _ts_node_descendants_of_type_wasm = Module["_ts_node_descendants_of_type_wasm"] = wasmExports["ts_node_descendants_of_type_wasm"];
    var _ts_node_is_named_wasm = Module["_ts_node_is_named_wasm"] = wasmExports["ts_node_is_named_wasm"];
    var _ts_node_has_changes_wasm = Module["_ts_node_has_changes_wasm"] = wasmExports["ts_node_has_changes_wasm"];
    var _ts_node_has_error_wasm = Module["_ts_node_has_error_wasm"] = wasmExports["ts_node_has_error_wasm"];
    var _ts_node_is_error_wasm = Module["_ts_node_is_error_wasm"] = wasmExports["ts_node_is_error_wasm"];
    var _ts_node_is_missing_wasm = Module["_ts_node_is_missing_wasm"] = wasmExports["ts_node_is_missing_wasm"];
    var _ts_node_is_extra_wasm = Module["_ts_node_is_extra_wasm"] = wasmExports["ts_node_is_extra_wasm"];
    var _ts_node_parse_state_wasm = Module["_ts_node_parse_state_wasm"] = wasmExports["ts_node_parse_state_wasm"];
    var _ts_node_next_parse_state_wasm = Module["_ts_node_next_parse_state_wasm"] = wasmExports["ts_node_next_parse_state_wasm"];
    var _ts_query_matches_wasm = Module["_ts_query_matches_wasm"] = wasmExports["ts_query_matches_wasm"];
    var _ts_query_captures_wasm = Module["_ts_query_captures_wasm"] = wasmExports["ts_query_captures_wasm"];
    var _memset = Module["_memset"] = wasmExports["memset"];
    var _memcpy = Module["_memcpy"] = wasmExports["memcpy"];
    var _memmove = Module["_memmove"] = wasmExports["memmove"];
    var _iswalpha = Module["_iswalpha"] = wasmExports["iswalpha"];
    var _iswblank = Module["_iswblank"] = wasmExports["iswblank"];
    var _iswdigit = Module["_iswdigit"] = wasmExports["iswdigit"];
    var _iswlower = Module["_iswlower"] = wasmExports["iswlower"];
    var _iswupper = Module["_iswupper"] = wasmExports["iswupper"];
    var _iswxdigit = Module["_iswxdigit"] = wasmExports["iswxdigit"];
    var _memchr = Module["_memchr"] = wasmExports["memchr"];
    var _strlen = Module["_strlen"] = wasmExports["strlen"];
    var _strcmp = Module["_strcmp"] = wasmExports["strcmp"];
    var _strncat = Module["_strncat"] = wasmExports["strncat"];
    var _strncpy = Module["_strncpy"] = wasmExports["strncpy"];
    var _towlower = Module["_towlower"] = wasmExports["towlower"];
    var _towupper = Module["_towupper"] = wasmExports["towupper"];
    var _setThrew = wasmExports["setThrew"];
    var __emscripten_stack_restore = wasmExports["_emscripten_stack_restore"];
    var __emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"];
    var _emscripten_stack_get_current = wasmExports["emscripten_stack_get_current"];
    var ___wasm_apply_data_relocs = wasmExports["__wasm_apply_data_relocs"];
    Module["setValue"] = setValue;
    Module["getValue"] = getValue;
    Module["UTF8ToString"] = UTF8ToString;
    Module["stringToUTF8"] = stringToUTF8;
    Module["lengthBytesUTF8"] = lengthBytesUTF8;
    Module["AsciiToString"] = AsciiToString;
    Module["stringToUTF16"] = stringToUTF16;
    Module["loadWebAssemblyModule"] = loadWebAssemblyModule;
    function callMain(args2 = []) {
      var entryFunction = resolveGlobalSymbol("main").sym;
      if (!entryFunction) return;
      args2.unshift(thisProgram);
      var argc = args2.length;
      var argv = stackAlloc((argc + 1) * 4);
      var argv_ptr = argv;
      args2.forEach((arg) => {
        LE_HEAP_STORE_U32((argv_ptr >> 2) * 4, stringToUTF8OnStack(arg));
        argv_ptr += 4;
      });
      LE_HEAP_STORE_U32((argv_ptr >> 2) * 4, 0);
      try {
        var ret = entryFunction(argc, argv);
        exitJS(
          ret,
          /* implicit = */
          true
        );
        return ret;
      } catch (e) {
        return handleException(e);
      }
    }
    __name(callMain, "callMain");
    function run(args2 = arguments_) {
      if (runDependencies > 0) {
        dependenciesFulfilled = run;
        return;
      }
      preRun();
      if (runDependencies > 0) {
        dependenciesFulfilled = run;
        return;
      }
      function doRun() {
        Module["calledRun"] = true;
        if (ABORT) return;
        initRuntime();
        preMain();
        readyPromiseResolve(Module);
        Module["onRuntimeInitialized"]?.();
        var noInitialRun = Module["noInitialRun"];
        if (!noInitialRun) callMain(args2);
        postRun();
      }
      __name(doRun, "doRun");
      if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(() => {
          setTimeout(() => Module["setStatus"](""), 1);
          doRun();
        }, 1);
      } else {
        doRun();
      }
    }
    __name(run, "run");
    if (Module["preInit"]) {
      if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
      while (Module["preInit"].length > 0) {
        Module["preInit"].pop()();
      }
    }
    run();
    moduleRtn = readyPromise;
    return moduleRtn;
  };
})();
var tree_sitter_default = Module2;
var Module3 = null;
async function initializeBinding(moduleOptions) {
  if (!Module3) {
    Module3 = await tree_sitter_default(moduleOptions);
  }
  return Module3;
}
__name(initializeBinding, "initializeBinding");
function checkModule() {
  return !!Module3;
}
__name(checkModule, "checkModule");
var TRANSFER_BUFFER;
var LANGUAGE_VERSION;
var MIN_COMPATIBLE_VERSION;
var Parser = class {
  static {
    __name(this, "Parser");
  }
  /** @internal */
  [0] = 0;
  // Internal handle for WASM
  /** @internal */
  [1] = 0;
  // Internal handle for WASM
  /** @internal */
  logCallback = null;
  /** The parser's current language. */
  language = null;
  /**
   * This must always be called before creating a Parser.
   *
   * You can optionally pass in options to configure the WASM module, the most common
   * one being `locateFile` to help the module find the `.wasm` file.
   */
  static async init(moduleOptions) {
    setModule(await initializeBinding(moduleOptions));
    TRANSFER_BUFFER = C._ts_init();
    LANGUAGE_VERSION = C.getValue(TRANSFER_BUFFER, "i32");
    MIN_COMPATIBLE_VERSION = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
  }
  /**
   * Create a new parser.
   */
  constructor() {
    this.initialize();
  }
  /** @internal */
  initialize() {
    if (!checkModule()) {
      throw new Error("cannot construct a Parser before calling `init()`");
    }
    C._ts_parser_new_wasm();
    this[0] = C.getValue(TRANSFER_BUFFER, "i32");
    this[1] = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
  }
  /** Delete the parser, freeing its resources. */
  delete() {
    C._ts_parser_delete(this[0]);
    C._free(this[1]);
    this[0] = 0;
    this[1] = 0;
  }
  /**
   * Set the language that the parser should use for parsing.
   *
   * If the language was not successfully assigned, an error will be thrown.
   * This happens if the language was generated with an incompatible
   * version of the Tree-sitter CLI. Check the language's version using
   * {@link Language#version} and compare it to this library's
   * {@link LANGUAGE_VERSION} and {@link MIN_COMPATIBLE_VERSION} constants.
   */
  setLanguage(language) {
    let address;
    if (!language) {
      address = 0;
      this.language = null;
    } else if (language.constructor === Language) {
      address = language[0];
      const version = C._ts_language_version(address);
      if (version < MIN_COMPATIBLE_VERSION || LANGUAGE_VERSION < version) {
        throw new Error(
          `Incompatible language version ${version}. Compatibility range ${MIN_COMPATIBLE_VERSION} through ${LANGUAGE_VERSION}.`
        );
      }
      this.language = language;
    } else {
      throw new Error("Argument must be a Language");
    }
    C._ts_parser_set_language(this[0], address);
    return this;
  }
  /**
   * Parse a slice of UTF8 text.
   *
   * @param {string | ParseCallback} callback - The UTF8-encoded text to parse or a callback function.
   *
   * @param {Tree | null} [oldTree] - A previous syntax tree parsed from the same document. If the text of the
   *   document has changed since `oldTree` was created, then you must edit `oldTree` to match
   *   the new text using {@link Tree#edit}.
   *
   * @param {ParseOptions} [options] - Options for parsing the text.
   *  This can be used to set the included ranges, or a progress callback.
   *
   * @returns {Tree | null} A {@link Tree} if parsing succeeded, or `null` if:
   *  - The parser has not yet had a language assigned with {@link Parser#setLanguage}.
   *  - The progress callback returned true.
   */
  parse(callback, oldTree, options) {
    if (typeof callback === "string") {
      C.currentParseCallback = (index) => callback.slice(index);
    } else if (typeof callback === "function") {
      C.currentParseCallback = callback;
    } else {
      throw new Error("Argument must be a string or a function");
    }
    if (options?.progressCallback) {
      C.currentProgressCallback = options.progressCallback;
    } else {
      C.currentProgressCallback = null;
    }
    if (this.logCallback) {
      C.currentLogCallback = this.logCallback;
      C._ts_parser_enable_logger_wasm(this[0], 1);
    } else {
      C.currentLogCallback = null;
      C._ts_parser_enable_logger_wasm(this[0], 0);
    }
    let rangeCount = 0;
    let rangeAddress = 0;
    if (options?.includedRanges) {
      rangeCount = options.includedRanges.length;
      rangeAddress = C._calloc(rangeCount, SIZE_OF_RANGE);
      let address = rangeAddress;
      for (let i2 = 0; i2 < rangeCount; i2++) {
        marshalRange(address, options.includedRanges[i2]);
        address += SIZE_OF_RANGE;
      }
    }
    const treeAddress = C._ts_parser_parse_wasm(
      this[0],
      this[1],
      oldTree ? oldTree[0] : 0,
      rangeAddress,
      rangeCount
    );
    if (!treeAddress) {
      C.currentParseCallback = null;
      C.currentLogCallback = null;
      C.currentProgressCallback = null;
      return null;
    }
    if (!this.language) {
      throw new Error("Parser must have a language to parse");
    }
    const result = new Tree(INTERNAL, treeAddress, this.language, C.currentParseCallback);
    C.currentParseCallback = null;
    C.currentLogCallback = null;
    C.currentProgressCallback = null;
    return result;
  }
  /**
   * Instruct the parser to start the next parse from the beginning.
   *
   * If the parser previously failed because of a timeout, cancellation,
   * or callback, then by default, it will resume where it left off on the
   * next call to {@link Parser#parse} or other parsing functions.
   * If you don't want to resume, and instead intend to use this parser to
   * parse some other document, you must call `reset` first.
   */
  reset() {
    C._ts_parser_reset(this[0]);
  }
  /** Get the ranges of text that the parser will include when parsing. */
  getIncludedRanges() {
    C._ts_parser_included_ranges_wasm(this[0]);
    const count = C.getValue(TRANSFER_BUFFER, "i32");
    const buffer = C.getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
    const result = new Array(count);
    if (count > 0) {
      let address = buffer;
      for (let i2 = 0; i2 < count; i2++) {
        result[i2] = unmarshalRange(address);
        address += SIZE_OF_RANGE;
      }
      C._free(buffer);
    }
    return result;
  }
  /**
   * @deprecated since version 0.25.0, prefer passing a progress callback to {@link Parser#parse}
   *
   * Get the duration in microseconds that parsing is allowed to take.
   *
   * This is set via {@link Parser#setTimeoutMicros}.
   */
  getTimeoutMicros() {
    return C._ts_parser_timeout_micros(this[0]);
  }
  /**
   * @deprecated since version 0.25.0, prefer passing a progress callback to {@link Parser#parse}
   *
   * Set the maximum duration in microseconds that parsing should be allowed
   * to take before halting.
   *
   * If parsing takes longer than this, it will halt early, returning `null`.
   * See {@link Parser#parse} for more information.
   */
  setTimeoutMicros(timeout) {
    C._ts_parser_set_timeout_micros(this[0], 0, timeout);
  }
  /** Set the logging callback that a parser should use during parsing. */
  setLogger(callback) {
    if (!callback) {
      this.logCallback = null;
    } else if (typeof callback !== "function") {
      throw new Error("Logger callback must be a function");
    } else {
      this.logCallback = callback;
    }
    return this;
  }
  /** Get the parser's current logger. */
  getLogger() {
    return this.logCallback;
  }
};

// engine/src/parser.ts
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
  initialized ??= Parser.init({ locateFile: () => path6.join(grammarsDir(), "tree-sitter.wasm") });
  return initialized;
}
async function parse(grammar, source) {
  await init2();
  let lang = languages.get(grammar);
  if (!lang) {
    lang = Language.load(path6.join(grammarsDir(), `tree-sitter-${grammar}.wasm`));
    languages.set(grammar, lang);
  }
  const parser = new Parser();
  parser.setLanguage(await lang);
  const tree = parser.parse(source.endsWith("\n") ? source : `${source}
`);
  parser.delete();
  if (!tree) throw new Error(`O tree-sitter n\xE3o conseguiu ler o arquivo (${grammar})`);
  return tree;
}

// engine/src/resolve-paths.ts
import fs4 from "node:fs";
import path8 from "node:path";

// engine/src/files.ts
var import_ignore = __toESM(require_ignore(), 1);
import fs3 from "node:fs";
import path7 from "node:path";
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
var GENERATED_NAME = /\.min\.(c|m)?js$|\.min\.css$|[.-]bundle\.(c|m)?js$|\.chunk\.(c|m)?js$/i;
var GENERATED_CHECK_BYTES = 64 * 1024;
var MAX_FILES = 5e3;
var IGNORE_FILES = [".gitignore", ".faundrignore"];
var MARKDOWN_EXT = /* @__PURE__ */ new Set([".md", ".mdx", ".qmd"]);
var MAX_FILE_BYTES = 2 * 1024 * 1024;
function isSkippedDir(name2, rel) {
  return SKIP_DIRS.has(name2) || name2.endsWith(".egg-info") || name2.endsWith("_venv") || rel === ".claude/worktrees";
}
function looksGenerated(abs, size) {
  if (size < GENERATED_CHECK_BYTES) return false;
  const fd = fs3.openSync(abs, "r");
  try {
    const buf = Buffer.alloc(GENERATED_CHECK_BYTES);
    const text = buf.subarray(0, fs3.readSync(fd, buf, 0, GENERATED_CHECK_BYTES, 0)).toString("utf8");
    return text.length / (text.split("\n").length || 1) > 1e3;
  } finally {
    fs3.closeSync(fd);
  }
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
      ig.add(fs3.readFileSync(path7.join(dirAbs, f), "utf8"));
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
function sortedEntries(dirAbs) {
  try {
    return fs3.readdirSync(dirAbs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
function tooBigOrGenerated(abs, ext) {
  try {
    const { size } = fs3.statSync(abs);
    if (size > MAX_FILE_BYTES) return true;
    return !MARKDOWN_EXT.has(ext) && ext !== ".json" && looksGenerated(abs, size);
  } catch {
    return true;
  }
}
function sourceFileOf(e, rel, abs, rules) {
  if (!e.isFile() || SKIP_FILES.has(e.name) || GENERATED_NAME.test(e.name) || isSensitive(rel) || ignored(rel, false, rules)) return null;
  const ext = path7.extname(e.name).toLowerCase();
  if (tooBigOrGenerated(abs, ext)) return null;
  if (MARKDOWN_EXT.has(ext)) return { rel, abs, kind: "markdown" };
  if (ext === ".json") return { rel, abs, kind: "json" };
  const lang = languageForFile(e.name);
  return lang ? { rel, abs, kind: "code", grammar: lang.grammar } : null;
}
function collectFiles(root) {
  const out2 = [];
  function walk(dirAbs, dirRel, inherited) {
    const own = loadRules(dirAbs, dirRel);
    const rules = own ? [...inherited, own] : inherited;
    for (const e of sortedEntries(dirAbs)) {
      const rel = dirRel ? `${dirRel}/${e.name}` : e.name;
      const abs = path7.join(dirAbs, e.name);
      if (e.isDirectory()) {
        if (!isSkippedDir(e.name, rel) && !ignored(rel, true, rules)) walk(abs, rel, rules);
        continue;
      }
      const file = sourceFileOf(e, rel, abs, rules);
      if (file) out2.push(file);
    }
  }
  walk(root, "", []);
  if (out2.length <= MAX_FILES) return Object.assign(out2, { dropped: 0 });
  const order = { code: 0, markdown: 1, json: 2 };
  const kept = [...out2].sort((a, b) => order[a.kind] - order[b.kind]).slice(0, MAX_FILES);
  return Object.assign(kept, { dropped: out2.length - MAX_FILES });
}

// engine/src/resolve-paths.ts
var JS_EXTS = [".ts", ".tsx", ".mts", ".cts", ".svelte", ".js", ".jsx", ".mjs", ".cjs"];
var JS_INDEX = ["index.ts", "index.tsx", "index.svelte", "index.js", "index.jsx", "index.mjs"];
function readJsonc(file) {
  try {
    const text = fs4.readFileSync(file, "utf8");
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
        targets: targets.map((t) => path8.posix.join(base, t)),
        exact: star === -1
      }
    ];
  });
}
var PathResolver = class {
  constructor(root) {
    this.root = root;
    const tsconfig = ["tsconfig.json", "jsconfig.json"].map((f) => path8.join(root, f)).find((f) => fs4.existsSync(f));
    this.hasTsconfig = !!tsconfig;
    if (tsconfig) {
      let cfg = readJsonc(tsconfig);
      if (typeof cfg?.extends === "string" && cfg.extends.startsWith(".")) {
        const parent = readJsonc(path8.resolve(path8.dirname(tsconfig), cfg.extends));
        cfg = { ...parent, ...cfg, compilerOptions: { ...parent?.compilerOptions, ...cfg.compilerOptions } };
      }
      const baseUrl = cfg?.compilerOptions?.baseUrl ?? ".";
      this.aliases = parsePatterns(cfg?.compilerOptions?.paths, path8.posix.normalize(baseUrl));
    }
    const pkg = readJsonc(path8.join(root, "package.json"));
    this.pkgImports = parsePatterns(pkg?.imports, ".");
    const composer = readJsonc(path8.join(root, "composer.json"));
    this.psr4 = Object.entries({ ...composer?.["autoload-dev"]?.["psr-4"], ...composer?.autoload?.["psr-4"] }).flatMap(([prefix, dirs]) => (Array.isArray(dirs) ? dirs : [dirs]).filter((d) => typeof d === "string").map((d) => ({ prefix, dir: d }))).sort((a, b) => b.prefix.length - a.prefix.length);
    this.dartPackage = readText(path8.join(root, "pubspec.yaml")).match(/^name:\s*([\w-]+)/m)?.[1] ?? null;
  }
  root;
  aliases = [];
  pkgImports = [];
  hasTsconfig;
  psr4 = [];
  dartPackage = null;
  files = null;
  goModule;
  // Java/Kotlin (package) e C# (namespace): pacote → arquivos que o declaram e os tipos/funções de topo de cada um.
  packages = /* @__PURE__ */ new Map();
  /** Os arquivos do projeto (lidos uma vez, só quando um import de Go, Java, Kotlin ou C# precisa). */
  sourceFiles() {
    this.files ??= collectFiles(this.root).filter((f) => f.kind === "code").map((f) => f.rel);
    return this.files;
  }
  exists(rel) {
    if (rel.startsWith("..")) return null;
    try {
      const st = fs4.statSync(path8.join(this.root, rel));
      if (st.isFile()) return "file";
      return st.isDirectory() ? "dir" : null;
    } catch {
      return null;
    }
  }
  /** Tenta um caminho relativo à raiz com as extensões e index do JS/TS. */
  tryJs(rel) {
    rel = path8.posix.normalize(rel);
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
    if (raw.startsWith(".")) return this.tryJs(path8.posix.join(path8.posix.dirname(fromRel), raw));
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
      const rel = path8.posix.normalize(baseRel);
      if (this.exists(`${rel}/__init__.py`) === "file") return `${rel}/__init__.py`;
      if (this.exists(`${rel}.py`) === "file") return `${rel}.py`;
      return null;
    };
    const modPath = module2.replace(/\./g, "/");
    if (level > 0) {
      let base = path8.posix.dirname(fromRel);
      for (let i2 = 1; i2 < level; i2++) base = path8.posix.dirname(base);
      return modPath ? probe(path8.posix.join(base, modPath)) : probe(base);
    }
    for (const prefix of ["", "src/", path8.posix.dirname(fromRel) + "/"]) {
      const hit = probe(prefix + modPath);
      if (hit) return hit;
    }
    return null;
  }
  resolveRelativeFile(raw, fromRel) {
    const rel = path8.posix.normalize(path8.posix.join(path8.posix.dirname(fromRel), raw));
    return this.exists(rel) === "file" ? rel : null;
  }
  /** PHP: classe com namespace (`App\Models\User`) → arquivo pelo PSR-4 do composer.json. */
  resolvePhpClass(fqcn) {
    const name2 = fqcn.replace(/^\\/, "");
    for (const { prefix, dir: dir2 } of this.psr4) {
      if (!name2.startsWith(prefix)) continue;
      const rel = path8.posix.join(dir2, `${name2.slice(prefix.length).replace(/\\/g, "/")}.php`);
      if (this.exists(path8.posix.normalize(rel)) === "file") return path8.posix.normalize(rel);
    }
    return null;
  }
  /** Dart: `package:<app>/x.dart` → lib/x.dart; caminho relativo → o arquivo ao lado. */
  resolveDart(uri, fromRel) {
    const pkg = uri.match(/^package:([\w-]+)\/(.+)$/);
    if (pkg) return pkg[1] === this.dartPackage && this.exists(`lib/${pkg[2]}`) === "file" ? `lib/${pkg[2]}` : null;
    if (/^dart:/.test(uri)) return null;
    return this.resolveRelativeFile(uri, fromRel);
  }
  /** Go: import do próprio módulo (go.mod) → os arquivos .go do pacote, sem os de teste. */
  resolveGo(importPath) {
    this.goModule ??= readText(path8.join(this.root, "go.mod")).match(/^module\s+(\S+)/m)?.[1] ?? null;
    const mod = this.goModule;
    if (!mod || importPath !== mod && !importPath.startsWith(`${mod}/`)) return [];
    const dir2 = importPath.slice(mod.length + 1);
    return this.sourceFiles().filter((f) => path8.posix.dirname(f) === (dir2 || ".") && f.endsWith(".go") && !f.endsWith("_test.go"));
  }
  /**
   * Java/Kotlin: `a.b.C`, `a.b.C.Inner`, `a.b.funcao` (Kotlin), `static a.b.C.m` e `a.b.*` → os arquivos
   * que declaram o pacote e o nome. Pelo `package` do arquivo, não pela pasta (no Kotlin elas não precisam bater).
   */
  resolveJvm(fq) {
    return this.byPackage("jvm", fq.replace(/^static\s+/, ""));
  }
  /** C#: `using A.B;` → os arquivos do namespace; `using static A.B.C;` e `using X = A.B.C;` → o arquivo da classe. */
  resolveCsharp(ns) {
    const files = this.packageIndex("cs").get(ns);
    if (files) return files.slice(0, MAX_PACKAGE_FILES).map((f) => f.rel);
    return this.byPackage("cs", ns);
  }
  byPackage(kind, fq) {
    const index = this.packageIndex(kind);
    if (fq.endsWith(".*")) return (index.get(fq.slice(0, -2)) ?? []).slice(0, MAX_PACKAGE_FILES).map((f) => f.rel);
    const parts2 = fq.split(".");
    for (let i2 = parts2.length - 1; i2 > 0; i2--) {
      const files = index.get(parts2.slice(0, i2).join("."));
      const hit = files?.filter((f) => f.names.has(parts2[i2])).map((f) => f.rel);
      if (hit?.length) return hit;
    }
    return [];
  }
  packageIndex(kind) {
    const cached = this.packages.get(kind);
    if (cached) return cached;
    const index = /* @__PURE__ */ new Map();
    const ext = kind === "jvm" ? /\.(java|kt|kts)$/ : /\.cs$/;
    for (const rel of this.sourceFiles().filter((f) => ext.test(f))) {
      const text = readText(path8.join(this.root, rel));
      const names = /* @__PURE__ */ new Set([path8.posix.basename(rel).replace(/\.\w+$/, ""), ...[...text.matchAll(DECLARED)].map((m) => m[1] ?? m[2])]);
      const pkgs = kind === "jvm" ? [text.match(/^\s*package\s+([\w.]+)/m)?.[1] ?? ""] : [...text.matchAll(/^\s*namespace\s+([\w.]+)/gm)].map((m) => m[1]);
      for (const pkg of pkgs) index.set(pkg, [...index.get(pkg) ?? [], { rel, names }]);
    }
    this.packages.set(kind, index);
    return index;
  }
};
var MAX_PACKAGE_FILES = 30;
var DECLARED = /\b(?:class|interface|enum|record|struct|object|@interface|typealias)\s+(\w+)|^(?:(?:public|private|internal|inline|suspend)\s+)*fun\s+(?:<[^>]*>\s*)?(?:[\w.]+\.)?(\w+)/gm;
function readText(file) {
  try {
    return fs4.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}
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
var IDENTIFIER_CALLEES = /* @__PURE__ */ new Set(["identifier", "type_identifier", "simple_identifier", "name"]);
var line = (n) => n.startPosition.row + 1;
var TYPED_IMPORTS = /* @__PURE__ */ new Set(["java", "kotlin", "csharp"]);
function span(n, body2) {
  const text = n.text;
  const at = body2 ? text.indexOf(body2.text) : -1;
  const head = (at > 0 ? text.slice(0, at) : text.split("\n")[0]).replace(/\s*=>\s*$/, "").replace(/[\s{:]+$/, "");
  const end = body2 && body2.endIndex > n.endIndex ? body2 : n;
  return { end_location: `L${end.endPosition.row + 1}`, signature: shorten(head, 200) };
}
function shorten(text, width = 80) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= width) return flat;
  const cut = flat.slice(0, width - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), width / 2))}\u2026`;
}
function isModuleLevel(n) {
  const p = n.parent;
  return p?.type === "program" || p?.type === "export_statement" && p.parent?.type === "program";
}
function unwrap(v) {
  while ((v.type === "as_expression" || v.type === "satisfies_expression" || v.type === "parenthesized_expression") && v.namedChildren[0]) v = v.namedChildren[0];
  return v;
}
async function extractCode(rel, source, cfg, resolver) {
  const tree = await parse(cfg.grammar, source);
  const out2 = new CodeExtractor(rel, cfg, resolver).run(tree.rootNode);
  tree.delete();
  return out2;
}
var CodeExtractor = class {
  constructor(rel, cfg, resolver) {
    this.rel = rel;
    this.cfg = cfg;
    this.resolver = resolver;
    this.stem = fileStem(rel);
    this.fileNid = fileNodeId(rel);
    this.out = { nodes: this.nodes, edges: this.edges, rawCalls: [], importBindings: [] };
  }
  rel;
  cfg;
  resolver;
  stem;
  fileNid;
  nodes = [];
  edges = [];
  out;
  seen = /* @__PURE__ */ new Set();
  functionBodies = [];
  trackedBodies = /* @__PURE__ */ new Set();
  callable = /* @__PURE__ */ new Set();
  callableClass = /* @__PURE__ */ new Set();
  labelToNid = /* @__PURE__ */ new Map();
  callPairs = /* @__PURE__ */ new Set();
  indirectPairs = /* @__PURE__ */ new Set();
  // Go: nomes locais dos pacotes do próprio módulo (`store "x/internal/db"` → store).
  goPackages = /* @__PURE__ */ new Set();
  run(root) {
    this.addNode(this.fileNid, path9.posix.basename(this.rel), 1);
    this.walk(root, null);
    this.rationales(root);
    this.walkAllCalls();
    if (this.cfg.js) this.out.typeTable = this.typeTable(root);
    if (TYPED_IMPORTS.has(this.cfg.importStyle)) this.out.typeTable = this.declaredTypes(root);
    this.markCallables();
    this.out.edges = this.localEdges();
    return this.out;
  }
  addNode(id, label, n, extra = {}) {
    if (!id || this.seen.has(id)) return;
    this.seen.add(id);
    this.nodes.push({
      id,
      label,
      file_type: "code",
      source_file: this.rel,
      source_location: `L${typeof n === "number" ? n : line(n)}`,
      ...extra
    });
  }
  addEdge(source, target, relation, n, opts = {}) {
    this.edges.push({
      source,
      target,
      relation,
      confidence: "EXTRACTED",
      source_file: this.rel,
      source_location: `L${typeof n === "number" ? n : line(n)}`,
      weight: 1,
      ...opts
    });
  }
  // Referência a um nome que não está definido neste arquivo: stub sem fonte, colapsado depois (§3.4).
  ensureNamed(name2) {
    const local = makeId(this.stem, name2);
    if (this.seen.has(local)) return local;
    const id = makeId(name2);
    if (id && !this.seen.has(id)) {
      this.seen.add(id);
      this.nodes.push({ id, label: name2, file_type: "code", source_file: "", source_location: "", origin_file: this.rel });
    }
    return id;
  }
  track(owner, body2) {
    if (!body2) return;
    this.functionBodies.push([owner, body2]);
    this.trackedBodies.add(body2.id);
  }
  // ---- nomes -------------------------------------------------------------------------------
  nameOf(n) {
    const cfg = this.cfg;
    if (cfg.name === "dart" && n.type === "method_signature") n = n.namedChildren.find((c) => c.type.endsWith("_signature")) ?? n;
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
  bodyOf(n) {
    if (this.cfg.name === "dart" && this.cfg.functionTypes.has(n.type)) return n.nextNamedSibling?.type === "function_body" ? n.nextNamedSibling : null;
    return n.childForFieldName("body") ?? n.namedChildren.find((c) => this.cfg.bodyFallback?.includes(c.type)) ?? null;
  }
  // ---- imports -----------------------------------------------------------------------------
  importJs(n) {
    const { rel, fileNid } = this;
    const srcNode = n.childForFieldName("source") ?? n.namedChildren.find((c) => c.type === "string");
    if (!srcNode) return false;
    const raw = srcNode.text.replace(/^['"`\s]+|['"`\s]+$/g, "");
    const typeOnly = n.children.some((c) => c.type === "type");
    const targetRel = this.resolver.resolveJs(raw, rel);
    const reexport = n.type === "export_statement";
    const target = targetRel ? fileNodeId(targetRel) : makeId("ref", packageRoot(raw));
    this.addEdge(fileNid, target, "imports_from", n, { context: reexport ? "re-export" : "import", ...typeOnly && { type_only: true } });
    if (!targetRel) return true;
    const targetStem = fileStem(targetRel);
    for (const spec of n.descendantsOfType(reexport ? "export_specifier" : "import_specifier")) {
      const imported = spec.childForFieldName("name")?.text;
      if (!imported || imported === "default") continue;
      const local = spec.childForFieldName("alias")?.text ?? imported;
      this.addEdge(fileNid, makeId(targetStem, imported), reexport ? "re_exports" : "imports", spec, {
        context: reexport ? "re-export" : "import"
      });
      this.out.importBindings.push({ local, imported, targetRel });
    }
    const clause = n.namedChildren.find((c) => c.type === "import_clause");
    const def = clause?.namedChildren.find((c) => c.type === "identifier");
    if (def) this.out.importBindings.push({ local: def.text, imported: "default", targetRel });
    return true;
  }
  importPython(n) {
    const { rel, fileNid } = this;
    if (n.type === "import_statement") {
      for (const d of n.namedChildren) {
        const mod2 = (d.type === "aliased_import" ? d.childForFieldName("name") : d)?.text;
        if (!mod2) continue;
        const targetRel2 = this.resolver.resolvePython(mod2, 0, rel);
        this.addEdge(fileNid, targetRel2 ? fileNodeId(targetRel2) : makeId(mod2), "imports", n, { context: "import" });
      }
      return;
    }
    const modNode = n.childForFieldName("module_name");
    if (!modNode) return;
    const text = modNode.text;
    const level = text.match(/^\.*/)[0].length;
    const mod = text.slice(level);
    const targetRel = this.resolver.resolvePython(mod, level, rel);
    this.addEdge(fileNid, targetRel ? fileNodeId(targetRel) : makeId(mod || text), "imports_from", n, { context: "import" });
    if (!targetRel) return;
    for (const d of n.childrenForFieldName("name")) {
      const imported = (d.type === "aliased_import" ? d.childForFieldName("name") : d)?.text;
      const local = d.type === "aliased_import" ? d.childForFieldName("alias")?.text : imported;
      if (!imported || !local) continue;
      this.addEdge(fileNid, makeId(fileStem(targetRel), imported), "imports", d, { context: "import" });
      this.out.importBindings.push({ local, imported, targetRel });
    }
  }
  /** PHP: `use App\Models\User` (e grupos `use App\{A, B}`) pelo PSR-4; `require`/`include` pelo caminho. */
  importPhp(n) {
    const { rel, fileNid } = this;
    if (n.type === "namespace_use_declaration") {
      for (const fq of phpUseNames(n)) {
        const targetRel2 = this.resolver.resolvePhpClass(fq);
        this.addEdge(fileNid, targetRel2 ? fileNodeId(targetRel2) : makeId("ref", fq), "imports", n, { context: "import" });
        const name2 = fq.split("\\").pop();
        if (targetRel2) this.out.importBindings.push({ local: name2, imported: name2, targetRel: targetRel2 });
      }
      return;
    }
    const raw = n.descendantsOfType(["string", "encapsed_string"])[0]?.text.replace(/^['"]|['"]$/g, "");
    if (!raw || !/\.php$/i.test(raw)) return;
    const targetRel = this.resolver.resolveRelativeFile(raw.replace(/^\//, ""), rel) ?? this.resolver.resolveRelativeFile(raw, rel);
    this.addEdge(fileNid, targetRel ? fileNodeId(targetRel) : makeId("ref", raw), "imports", n, { context: "import" });
  }
  /** Dart: `import 'package:app/x.dart'` → lib/x.dart; relativo → o arquivo; pacote de fora → ref. */
  importDart(n) {
    const uri = n.descendantsOfType("string_literal")[0]?.text.replace(/^['"]|['"]$/g, "");
    if (!uri) return;
    const targetRel = this.resolver.resolveDart(uri, this.rel);
    this.addEdge(this.fileNid, targetRel ? fileNodeId(targetRel) : makeId("ref", uri.replace(/^package:([\w-]+).*$/, "$1")), "imports_from", n, { context: "import" });
  }
  /** Go: import do próprio módulo (go.mod) → os arquivos do pacote; de fora → ref. */
  importGo(n) {
    for (const spec of n.descendantsOfType("import_spec")) {
      const raw = spec.childForFieldName("path")?.text.replace(/["`]/g, "");
      if (!raw) continue;
      const targets = this.resolver.resolveGo(raw);
      if (!targets.length) {
        this.addEdge(this.fileNid, makeId("ref", raw), "imports", spec, { context: "import" });
        continue;
      }
      this.goPackages.add(spec.childForFieldName("name")?.text ?? raw.split("/").pop());
      for (const t of targets) this.addEdge(this.fileNid, fileNodeId(t), "imports", spec, { context: "import" });
    }
  }
  /** Java/Kotlin (`import a.b.C`, `import a.b.f as g`, `import a.b.*`) e C# (`using A.B;`) → os arquivos pelo package/namespace. */
  importTyped(n) {
    const m = n.text.match(/^(?:global\s+)?(?:import|using)\s+(static\s+)?(?:(\w+)\s*=\s*)?([\w.]+(?:\.\*)?)(?:\s+as\s+(\w+))?/);
    if (!m) return;
    const [, , aliasEq, fq, aliasAs] = m;
    const targets = this.cfg.importStyle === "csharp" ? this.resolver.resolveCsharp(fq) : this.resolver.resolveJvm(fq);
    if (!targets.length) {
      this.addEdge(this.fileNid, makeId("ref", fq), "imports", n, { context: "import" });
      return;
    }
    const imported = fq.split(".").pop();
    for (const t of targets) {
      this.addEdge(this.fileNid, fileNodeId(t), "imports", n, { context: "import" });
      if (imported !== "*") this.out.importBindings.push({ local: aliasEq ?? aliasAs ?? imported, imported, targetRel: t });
    }
  }
  // Demais linguagens: o import vira referência a um módulo externo (stub criado no build).
  importOther(n) {
    const { rel, fileNid } = this;
    let raw = "";
    if (this.cfg.importStyle === "c") {
      const p = n.childForFieldName("path");
      if (!p) return;
      raw = p.text.replace(/^[<"]|[>"]$/g, "");
      const local = p.type === "string_literal" ? this.resolver.resolveRelativeFile(raw, rel) : null;
      this.addEdge(fileNid, local ? fileNodeId(local) : makeId("ref", raw), "imports", n, { context: "import" });
      return;
    }
    raw = n.text.replace(/^(import|using|use|namespace)\s+(static\s+)?/, "").replace(/[;{].*$/s, "").replace(/\s+as\s+\w+$/, "").trim();
    if (raw) this.addEdge(fileNid, makeId("ref", raw), "imports", n, { context: "import" });
  }
  // ---- herança -----------------------------------------------------------------------------
  heritage(n, classNid) {
    const emit = (nameNode, relation) => {
      if (!nameNode) return;
      const name2 = nameNode.text.replace(/<[\s\S]*$/, "").split(".").pop().trim();
      if (normalizeId(name2)) this.addEdge(classNid, this.ensureNamed(name2), relation, nameNode);
    };
    if (this.cfg.name === "python") {
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
  // ---- JS/TS: consts de módulo, arrow functions, closures em chamadas ----------------------
  jsExtraWalk(n, parentClass) {
    if (n.type === "lexical_declaration" && isModuleLevel(n)) {
      this.jsModuleConsts(n);
      return true;
    }
    if (n.type === "expression_statement" && n.parent?.type === "program") {
      this.track(this.fileNid, n);
      return true;
    }
    if ((n.type === "field_definition" || n.type === "public_field_definition") && parentClass && this.jsFunctionField(n, parentClass)) return true;
    if (n.type === "export_statement") this.jsDefaultExport(n);
    return false;
  }
  /** `const x = () => …` vira função; `const x = {…}` (ou qualquer const exportada) vira nó. */
  jsModuleConsts(n) {
    const exported = n.parent?.type === "export_statement";
    for (const d of n.namedChildren.filter((c) => c.type === "variable_declarator")) {
      const nameNode = d.childForFieldName("name");
      const value = d.childForFieldName("value");
      if (nameNode?.type !== "identifier" || !value) continue;
      const name2 = nameNode.text;
      const nid = makeId(this.stem, name2);
      const v = unwrap(value);
      if (JS_FUNCTION_VALUES.has(v.type)) {
        this.addNode(nid, `${name2}()`, d, span(d, v.childForFieldName("body")));
        this.addEdge(this.fileNid, nid, "contains", d);
        this.callable.add(nid);
        this.track(nid, v.childForFieldName("body"));
      } else if (JS_CONST_VALUES.has(v.type) || exported) {
        this.addNode(nid, name2, d, span(d, null));
        this.addEdge(this.fileNid, nid, "contains", d);
        this.track(nid, v);
      }
    }
  }
  /** Campo de classe com função (`handle = () => …`) vira método. Devolve se era o caso. */
  jsFunctionField(n, parentClass) {
    const value = n.childForFieldName("value");
    const name2 = (n.childForFieldName("name") ?? n.childForFieldName("property"))?.text;
    if (!value || !name2 || !JS_FUNCTION_VALUES.has(unwrap(value).type)) return false;
    const nid = makeId(parentClass, name2);
    this.addNode(nid, `.${name2}()`, n, span(n, unwrap(value).childForFieldName("body")));
    this.addEdge(parentClass, nid, "method", n);
    this.callable.add(nid);
    this.track(nid, unwrap(value).childForFieldName("body"));
    return true;
  }
  jsDefaultExport(n) {
    const def = n.children.some((c) => c.type === "default");
    const decl = n.childForFieldName("declaration") ?? n.childForFieldName("value");
    if (def && decl) {
      this.out.defaultExport = (decl.type === "identifier" ? decl : decl.childForFieldName("name"))?.text ?? this.out.defaultExport;
    }
  }
  // ---- caminhada principal -----------------------------------------------------------------
  walk(n, parentClass) {
    const t = n.type;
    const cfg = this.cfg;
    if (cfg.importTypes.has(t) && this.walkImport(n, parentClass)) return;
    if (cfg.classTypes.has(t)) return this.walkClass(n, parentClass);
    if (cfg.functionTypes.has(t)) return this.walkFunction(n, parentClass);
    if (cfg.js && this.jsExtraWalk(n, parentClass)) return;
    const keep = KEEP_PARENT.has(t) || cfg.name === "dart" && t === "declaration";
    for (const c of n.namedChildren) this.walk(c, keep ? parentClass : null);
  }
  /** Nó de import: registra e devolve se a caminhada para aqui. */
  walkImport(n, parentClass) {
    if (this.cfg.importStyle === "python") {
      this.importPython(n);
      return true;
    }
    if (this.cfg.importStyle === "php") {
      this.importPhp(n);
      return true;
    }
    if (this.cfg.importStyle === "dart") {
      this.importDart(n);
      return true;
    }
    if (this.cfg.importStyle === "go") {
      this.importGo(n);
      return true;
    }
    if (TYPED_IMPORTS.has(this.cfg.importStyle)) {
      this.importTyped(n);
      return true;
    }
    if (this.cfg.importStyle !== "js") {
      this.importOther(n);
      return true;
    }
    if (this.importJs(n)) return true;
    if (n.type !== "export_statement") return false;
    this.jsExtraWalk(n, parentClass);
    for (const c of n.namedChildren) this.walk(c, parentClass);
    return true;
  }
  walkClass(n, parentClass) {
    const name2 = this.nameOf(n);
    if (!name2) return;
    const nid = makeId(this.stem, name2);
    const isNew = !this.seen.has(nid);
    this.addNode(nid, name2, n, span(n, this.bodyOf(n)));
    if (isNew) this.addEdge(parentClass ?? this.fileNid, nid, "contains", n);
    this.callable.add(nid);
    this.callableClass.add(nid);
    this.heritage(n, nid);
    if (n.type === "enum_declaration" && this.cfg.js) {
      for (const m of n.descendantsOfType("property_identifier")) {
        const mid = makeId(nid, m.text);
        this.addNode(mid, m.text, m);
        this.addEdge(mid, nid, "case_of", m);
      }
    }
    const body2 = this.bodyOf(n);
    if (body2) for (const c of body2.namedChildren) this.walk(c, nid);
  }
  walkFunction(n, parentClass) {
    const name2 = this.nameOf(n);
    if (!name2) return;
    let owner = parentClass;
    if (this.cfg.name === "go" && n.type === "method_declaration") {
      const recv = n.childForFieldName("receiver")?.descendantsOfType("type_identifier")[0]?.text;
      if (recv) owner = makeId(this.stem, recv);
    }
    if (owner) {
      const nid = makeId(owner, name2);
      this.addNode(nid, `.${name2}()`, n, span(n, this.bodyOf(n)));
      this.addEdge(this.seen.has(owner) ? owner : this.fileNid, nid, this.seen.has(owner) ? "method" : "contains", n);
      this.callable.add(nid);
      this.track(nid, this.bodyOf(n));
    } else {
      const nid = makeId(this.stem, name2);
      this.addNode(nid, `${name2}()`, n, span(n, this.bodyOf(n)));
      this.addEdge(this.fileNid, nid, "contains", n);
      this.callable.add(nid);
      this.track(nid, this.bodyOf(n));
    }
  }
  // Comentários de racional (`// WHY: ...`, `# NOTE: ...`) viram nós ligados ao arquivo.
  rationales(root) {
    for (const c of root.descendantsOfType("comment")) {
      const m = c.text.trim().match(RATIONALE);
      if (!m) continue;
      const rid = makeId(this.stem, "rationale", String(line(c)));
      this.addNode(rid, shorten(`${m[1]}: ${m[2]}`), c, { file_type: "rationale" });
      this.addEdge(rid, this.fileNid, "rationale_for", c);
    }
  }
  // ---- chamadas ----------------------------------------------------------------------------
  walkAllCalls() {
    for (const nd of this.nodes) if (nd.source_file && nd.id !== this.fileNid) this.labelToNid.set(bareLabel(nd.label), nd.id);
    for (const [caller, body2] of this.functionBodies) this.walkCalls(body2, caller, this.localsOf(body2), true);
  }
  /** O nó que diz quem é chamado: construtor no `new`, tipo no Java, ou o campo da gramática. */
  calleeNode(n) {
    const cfg = this.cfg;
    if (n.type === "new_expression") return n.childForFieldName("constructor");
    if ((cfg.name === "java" || cfg.name === "csharp") && n.type === "object_creation_expression") return n.childForFieldName("type");
    if (cfg.callFunctionField) return n.childForFieldName(cfg.callFunctionField);
    return n.namedChildren[0];
  }
  calleeOf(n) {
    if (n.type === "jsx_opening_element" || n.type === "jsx_self_closing_element") {
      const nm = n.childForFieldName("name");
      if (nm?.type !== "identifier" || /^[a-z]/.test(nm.text)) return null;
      return { name: nm.text, member: false };
    }
    if (this.cfg.name === "dart") return dartCallee(n);
    if (this.cfg.name === "php") return phpCallee(n);
    const c = this.genericCallee(n);
    if (c?.member && c.receiver && this.goPackages.has(c.receiver)) return { name: c.name, member: false };
    return c;
  }
  genericCallee(n) {
    const fn7 = this.calleeNode(n);
    if (!fn7) return null;
    if (this.cfg.name === "java" && n.type === "method_invocation") {
      const obj = n.childForFieldName("object");
      return { name: fn7.text, member: !!obj, receiver: obj?.text };
    }
    if (IDENTIFIER_CALLEES.has(fn7.type)) return { name: fn7.text, member: false };
    if (this.cfg.accessorTypes.has(fn7.type)) return this.accessorCallee(fn7);
    return null;
  }
  /** `obj.metodo()`, `this.campo.metodo()`, `Tipo::new()`. */
  accessorCallee(fn7) {
    const cfg = this.cfg;
    const prop = cfg.accessorField ? fn7.childForFieldName(cfg.accessorField) : fn7.namedChildren[fn7.namedChildCount - 1];
    const obj = cfg.accessorObjectField ? fn7.childForFieldName(cfg.accessorObjectField) : fn7.namedChildren[0];
    const name2 = (prop ?? fn7.namedChildren[fn7.namedChildCount - 1])?.text.replace(/^\./, "");
    if (!name2) return null;
    if (obj?.type === "member_expression" && obj.childForFieldName("object")?.type === "this") {
      return { name: name2, member: true, receiver: obj.childForFieldName("property")?.text, thisField: true };
    }
    if (fn7.type === "scoped_identifier" || fn7.type === "qualified_identifier") {
      const path17 = fn7.childForFieldName("path") ?? fn7.childForFieldName("scope");
      return { name: name2, member: true, receiver: path17?.text };
    }
    return { name: name2, member: true, receiver: obj?.type === "identifier" || obj?.type === "this" || obj?.type === "self" ? obj.text : obj?.text.slice(0, 40) };
  }
  localsOf(body2) {
    const names = /* @__PURE__ */ new Set();
    const params = body2.parent?.childForFieldName("parameters") ?? body2.parent?.childForFieldName("parameter");
    for (const id of params?.descendantsOfType(["identifier", "shorthand_property_identifier_pattern"]) ?? []) names.add(id.text);
    for (const d of body2.descendantsOfType(["variable_declarator"])) {
      const nm = d.childForFieldName("name");
      if (nm) for (const id of nm.type === "identifier" ? [nm] : nm.descendantsOfType(["identifier", "shorthand_property_identifier_pattern"])) names.add(id.text);
    }
    return names;
  }
  emitIndirect(caller, name2, n, context, locals) {
    if (locals.has(name2) || name2 === "self" || name2 === "cls" || BUILTIN_GLOBALS.has(name2)) return;
    const tgt = this.labelToNid.get(name2);
    if (tgt) {
      if (tgt === caller || !this.callable.has(tgt) || this.callableClass.has(tgt)) return;
      const key = `${caller}->${tgt}`;
      if (this.callPairs.has(key) || this.indirectPairs.has(key)) return;
      this.indirectPairs.add(key);
      this.addEdge(caller, tgt, "indirect_call", n, { confidence: "INFERRED", confidence_score: 0.85, context });
    } else if (/^[A-Za-z_$][\w$]*$/.test(name2)) {
      this.out.rawCalls.push({ caller, callee: name2, isMember: false, sourceFile: this.rel, line: line(n), indirect: true, context });
    }
  }
  walkCalls(n, caller, locals, isRoot) {
    const cfg = this.cfg;
    if (!isRoot && cfg.boundaryTypes.has(n.type)) {
      const inner = this.innerLocals(n, locals);
      if (!inner) return;
      locals = inner;
    }
    if (cfg.callTypes.has(n.type)) this.visitCall(n, caller, locals);
    if (cfg.js && (n.type === "pair" || n.type === "shorthand_property_identifier")) {
      const v = n.type === "pair" ? n.childForFieldName("value") : n;
      if (v && (v.type === "identifier" || v.type === "shorthand_property_identifier")) this.emitIndirect(caller, v.text, v, "collection", locals);
    }
    for (const c of n.namedChildren) this.walkCalls(c, caller, locals, false);
  }
  /** Função dentro da função: só desce nas closures JS não rastreadas, somando os nomes locais delas. */
  innerLocals(n, locals) {
    const body2 = n.childForFieldName("body");
    if (!(this.cfg.js && JS_DESCEND.has(n.type) && body2 && !this.trackedBodies.has(body2.id))) return null;
    return /* @__PURE__ */ new Set([...locals, ...this.localsOf(body2)]);
  }
  visitCall(n, caller, locals) {
    const cfg = this.cfg;
    const fnNode = n.childForFieldName("function");
    if (cfg.js && fnNode?.type === "import") return this.dynamicImport(n, caller);
    const c = this.calleeOf(n);
    if (c && !(!c.member && BUILTIN_GLOBALS.has(c.name))) this.directCall(n, caller, locals, c);
    if (cfg.js || cfg.name === "python") {
      for (const a of n.childForFieldName("arguments")?.namedChildren ?? []) {
        if (a.type === "identifier") this.emitIndirect(caller, a.text, a, "argument", locals);
      }
    }
  }
  dynamicImport(n, caller) {
    const arg = n.childForFieldName("arguments")?.namedChildren[0];
    if (arg?.type !== "string") return;
    const raw = arg.text.replace(/^['"`]|['"`]$/g, "");
    const targetRel = this.resolver.resolveJs(raw, this.rel);
    this.addEdge(caller, targetRel ? fileNodeId(targetRel) : makeId("ref", packageRoot(raw)), "imports_from", n, {
      context: "import",
      deferred: true
    });
  }
  /** Chamada de método que só a fase entre arquivos sabe resolver (receptor de fora, tipo, `this.campo`). */
  deferCall(c) {
    const cfg = this.cfg;
    const pyForeign = cfg.name === "python" && c.member && !["self", "cls", "super"].includes(c.receiver ?? "");
    return c.member && BUILTIN_GLOBALS.has(c.receiver ?? "") || c.member && (/^[A-Z]/.test(c.receiver ?? "") || !!c.thisField) || pyForeign || c.member && ["java", "csharp"].includes(cfg.name);
  }
  directCall(n, caller, locals, c) {
    const tgt = this.deferCall(c) ? void 0 : this.labelToNid.get(c.name);
    if (tgt) {
      const key = `${caller}->${tgt}`;
      if (this.callPairs.has(key)) return;
      this.callPairs.add(key);
      this.addEdge(caller, tgt, "calls", n, { context: "call" });
      return;
    }
    if (this.cfg.name === "python" && !c.member && locals.has(c.name)) return;
    this.out.rawCalls.push({ caller, callee: c.name, isMember: c.member, receiver: c.receiver, sourceFile: this.rel, line: line(n) });
  }
  // TS: `const x = new Foo()` e parâmetros `(svc: Svc)` → tipo do receptor para `x.metodo()`.
  typeTable(root) {
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
    return table;
  }
  /** Java, Kotlin e C#: `User u`, `u: Repo`, `var x = new User()`, `val y = Repo()` → tipo do receptor para `u.metodo()`. */
  declaredTypes(root) {
    const table = {};
    const set = (name2, type) => {
      const t = type?.replace(/<[\s\S]*$/, "").replace(/\?$/, "").split(".").pop();
      if (name2 && t && /^[A-Z]\w*$/.test(t)) table[name2] ??= t;
    };
    const created = (v) => {
      if (v?.type === "object_creation_expression") return v.childForFieldName("type")?.text;
      const callee2 = v?.type === "call_expression" ? v.namedChildren[0] : null;
      return callee2?.type === "simple_identifier" ? callee2.text : void 0;
    };
    for (const d of root.descendantsOfType(["formal_parameter", "parameter", "local_variable_declaration", "field_declaration", "variable_declaration"])) {
      if (this.cfg.name === "kotlin") {
        const ty2 = d.namedChildren.find((c) => c.type === "user_type" || c.type === "nullable_type")?.text;
        set(d.namedChildren.find((c) => c.type === "simple_identifier")?.text, ty2 ?? (d.type === "variable_declaration" ? created(d.nextNamedSibling) : void 0));
        continue;
      }
      const ty = d.childForFieldName("type");
      if (d.type === "formal_parameter" || d.type === "parameter") {
        set(d.childForFieldName("name")?.text, ty?.text);
        continue;
      }
      for (const v of d.namedChildren.filter((c) => c.type === "variable_declarator")) {
        const name2 = (v.childForFieldName("name") ?? v.namedChildren.find((c) => c.type === "identifier"))?.text;
        const value = v.childForFieldName("value") ?? v.namedChildren.find((c) => c.type === "equals_value_clause")?.namedChildren[0];
        set(name2, ty && ty.text !== "var" ? ty.text : created(value));
      }
    }
    return table;
  }
  markCallables() {
    for (const nd of this.nodes) {
      if (this.callable.has(nd.id)) nd._callable = true;
      if (this.callableClass.has(nd.id)) nd._callable_class = true;
    }
  }
  // Limpeza por arquivo (§1.5): arestas saindo de nós deste arquivo; alvo local ou relação de import.
  localEdges() {
    const local = new Set(this.nodes.map((nd) => nd.id));
    const dedupe = /* @__PURE__ */ new Set();
    return this.edges.filter((e) => {
      if (!local.has(e.source)) return false;
      if (!local.has(e.target) && !["imports", "imports_from", "re_exports"].includes(e.relation)) return false;
      const key = JSON.stringify(e);
      if (dedupe.has(key)) return false;
      dedupe.add(key);
      return true;
    });
  }
};
function dartCallee(n) {
  if (!n.namedChildren.some((c) => c.type === "argument_part")) return null;
  const prev = n.previousNamedSibling;
  if (prev?.type === "identifier") return { name: prev.text, member: false };
  const access = prev?.type === "selector" ? prev.namedChildren.find((c) => c.type.endsWith("assignable_selector")) : null;
  const name2 = access?.namedChildren.find((c) => c.type === "identifier")?.text;
  if (!name2) return null;
  const receiver = prev.previousNamedSibling;
  return { name: name2, member: true, receiver: receiver?.type === "identifier" || receiver?.type === "this" ? receiver.text : void 0 };
}
function phpCallee(n) {
  if (n.type === "function_call_expression") {
    const fn7 = n.childForFieldName("function");
    return fn7 && (fn7.type === "name" || fn7.type === "qualified_name") ? { name: fn7.text.split("\\").pop(), member: false } : null;
  }
  if (n.type === "object_creation_expression") {
    const cls = n.namedChildren.find((c) => c.type === "name" || c.type === "qualified_name");
    return cls ? { name: cls.text.split("\\").pop(), member: false } : null;
  }
  const name2 = n.childForFieldName("name")?.text;
  if (!name2) return null;
  if (n.type === "scoped_call_expression") {
    const scope = n.childForFieldName("scope")?.text;
    return { name: name2, member: true, receiver: scope === "self" || scope === "static" || scope === "parent" ? "self" : scope };
  }
  const obj = n.childForFieldName("object");
  const thisField = obj?.type === "member_access_expression" && obj.childForFieldName("object")?.text === "$this";
  return { name: name2, member: true, receiver: obj?.text === "$this" ? "this" : obj?.text.slice(0, 40), thisField };
}
function phpUseNames(n) {
  const group = n.namedChildren.find((c) => c.type === "namespace_use_group");
  if (!group) return n.namedChildren.filter((c) => c.type === "namespace_use_clause").map((c) => c.namedChildren.find((x) => x.type === "qualified_name" || x.type === "name")?.text ?? "").filter(Boolean);
  const prefix = n.namedChildren.find((c) => c.type === "namespace_name")?.text ?? "";
  return group.namedChildren.map((c) => c.namedChildren.find((x) => x.type === "namespace_name" || x.type === "name")?.text).filter((x) => !!x).map((x) => `${prefix}\\${x}`);
}

// engine/src/extract-docs.ts
import fs5 from "node:fs";
import path10 from "node:path";
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
  if (!path10.posix.extname(target)) target += ".md";
  if (!DOC_EXTS.has(path10.posix.extname(target).toLowerCase())) return null;
  const candidate = path10.posix.normalize(path10.posix.join(path10.posix.dirname(rel), target));
  if (!candidate.startsWith("..") && fs5.existsSync(path10.join(root, candidate))) return candidate;
  if (wiki) {
    const base = path10.posix.basename(target).toLowerCase();
    const hits = allDocs.filter((d) => d.toLowerCase().endsWith(`/${base}`) || d.toLowerCase() === base);
    hits.sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
    return hits[0] ?? null;
  }
  return null;
}
function extractMarkdown(rel, source, root, allDocs) {
  const stem2 = fileStem(rel);
  const fileNid = fileNodeId(rel);
  const nodes = [
    { id: fileNid, label: path10.posix.basename(rel), file_type: "document", source_file: rel, source_location: "L1", node_kind: "page" }
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
      let id = makeId(stem2, title);
      if (!normalizeId(title)) return;
      if (seen.has(id)) id = makeId(stem2, title, String(ln));
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
  const name2 = path10.posix.basename(rel);
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
  const stem2 = fileStem(rel);
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
      const id = makeId(stem2, parentKey ?? void 0, key);
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

// engine/src/cache.ts
import crypto from "node:crypto";
import fs6 from "node:fs";
import path11 from "node:path";
var EXTRACT_VERSION = 2;
var cacheFile = (root) => path11.join(root, ".faundr", "cache", "extract-cache.json");
var printsFile = (root) => path11.join(root, ".faundr", "cache", "fingerprints.json");
var hashText = (text) => crypto.createHash("sha1").update(text).digest("hex");
var fileSetKey = (files) => hashText(files.map((f) => f.rel).sort().join("\n"));
function loadCache(root, files) {
  try {
    const cache = JSON.parse(fs6.readFileSync(cacheFile(root), "utf8"));
    if (cache.version === EXTRACT_VERSION && cache.fileSet === fileSetKey(files)) return cache.files;
  } catch {
  }
  return {};
}
function saveCache(root, files, entries) {
  try {
    fs6.mkdirSync(path11.dirname(cacheFile(root)), { recursive: true });
    const cache = { version: EXTRACT_VERSION, fileSet: fileSetKey(files), files: entries };
    fs6.writeFileSync(cacheFile(root), JSON.stringify(cache));
    const prints = { version: EXTRACT_VERSION, fileSet: cache.fileSet, files: Object.fromEntries(Object.entries(entries).map(([r, e]) => [r, [e.size, e.mtimeMs]])) };
    fs6.writeFileSync(printsFile(root), JSON.stringify(prints));
  } catch {
  }
}
function staleFiles(root, files) {
  let cache = null;
  try {
    cache = JSON.parse(fs6.readFileSync(printsFile(root), "utf8"));
  } catch {
  }
  if (!cache || cache.version !== EXTRACT_VERSION) return { stale: files.map((f) => f.rel), setChanged: true };
  if (cache.fileSet !== fileSetKey(files)) {
    const before = new Set(Object.keys(cache.files));
    const now = new Set(files.map((f) => f.rel));
    return { stale: [...[...now].filter((r) => !before.has(r)), ...[...before].filter((r) => !now.has(r))], setChanged: true };
  }
  const stale = [];
  for (const f of files) {
    const old = cache.files[f.rel];
    try {
      const st = fs6.statSync(f.abs);
      if (!old || old[0] !== st.size || old[1] !== st.mtimeMs) stale.push(f.rel);
    } catch {
      stale.push(f.rel);
    }
  }
  return { stale, setChanged: false };
}

// engine/src/report.ts
import path12 from "node:path";
var MIN_COMMUNITY = 3;
function renderReport(opts) {
  const { g, communities } = opts;
  const real = (members) => members.filter((m) => !isFileNode(g, m));
  const thin = [...communities.values()].filter((m) => real(m).length < MIN_COMMUNITY).length;
  const L = [
    ...summarySection(opts, thin),
    ...centralSections(opts, real),
    ...communitySection(opts, real, thin),
    ...gapsSection(g, thin)
  ];
  L.push("## Perguntas sugeridas", "_Perguntas que este grafo responde bem:_", "");
  for (const q of opts.questions) L.push(`- **${q.question}**`, `  _${q.why}_`);
  return L.join("\n") + "\n";
}
function summarySection(opts, thin) {
  const { g, communities } = opts;
  const L = [];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
  L.push(`# Relat\xF3rio do grafo - ${path12.basename(opts.root)}  (${today})`, "");
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
  return L;
}
function centralSections(opts, real) {
  const L = [];
  L.push("## Comunidades (navega\xE7\xE3o)");
  for (const [cid, members] of opts.communities) if (real(members).length >= 1) L.push(`- ${opts.names.get(cid)}`);
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
  return L;
}
function communitySection(opts, real, thin) {
  const { g, communities, names } = opts;
  const L = [`## Comunidades (${communities.size} no total${thin ? `, ${thin} pequenas omitidas` : ""})`, ""];
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
  return L;
}
function gapsSection(g, thin) {
  const isolated = g.nodes().filter((n) => g.degree(n) <= 1 && !isFileNode(g, n) && !isConceptNode(g, n) && g.getNodeAttribute(n, "file_type") !== "rationale");
  if (!isolated.length && !thin) return [];
  const L = ["## Lacunas"];
  if (isolated.length) {
    L.push(
      `- **${isolated.length} n\xF3(s) isolado(s):** ${isolated.slice(0, 5).map((n) => `\`${g.getNodeAttribute(n, "label")}\``).join(", ")}${isolated.length > 5 ? ` (+${isolated.length - 5})` : ""}`,
      "  T\xEAm no m\xE1ximo 1 liga\xE7\xE3o: poss\xEDveis liga\xE7\xF5es faltando ou componentes sem uso."
    );
  }
  if (thin) L.push(`- **${thin} comunidades pequenas (<${MIN_COMMUNITY} n\xF3s) omitidas** \u2014 use \`faundr graph-query\` para explor\xE1-las.`);
  L.push("");
  return L;
}

// engine/src/roles.ts
import path13 from "node:path";
var dir = (re) => new RegExp(`(^|/)(${re})/`, "i");
function roleForFile(rel) {
  const ext = path13.posix.extname(rel).toLowerCase();
  const base = path13.posix.basename(rel).toLowerCase();
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
  const base = path13.posix.basename(rel);
  if (role === "document") {
    if (docTitle) return docTitle;
    const parent = path13.posix.basename(path13.posix.dirname(rel));
    if (/^skill.md$/i.test(base) && parent) return `Comando ${humanize(parent)}`;
    if (/^(readme|index).mdx?$/i.test(base) && parent && parent !== ".") return humanize(parent);
    return humanize(base);
  }
  if (role === "screen" || role === "api") {
    if (/__root\./.test(base)) return "Estrutura base das p\xE1ginas";
    const route = routePath(rel);
    if (route && role === "api") return `API ${route}`;
    if (route) return route === "/" ? "P\xE1gina inicial" : `P\xE1gina ${route}`;
  }
  if (role === "database") return `Banco: ${humanize(base.replace(/^\d+[_-]/, ""))}`;
  return humanize(base);
}

// engine/src/pipeline.ts
var OUT_DIR = ".faundr/mapa";
function gitCommit(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || void 0;
  } catch {
    return void 0;
  }
}
async function extractAll(root, files) {
  const resolver = new PathResolver(root);
  const docs = files.filter((f) => f.kind === "markdown").map((f) => f.rel);
  const cached = loadCache(root, files);
  const entries = {};
  const changed = [];
  let words = 0;
  for (const f of files) {
    let st;
    try {
      st = fs7.statSync(f.abs);
    } catch {
      continue;
    }
    const old = cached[f.rel];
    if (old && old.size === st.size && old.mtimeMs === st.mtimeMs) {
      entries[f.rel] = old;
      words += old.words;
      continue;
    }
    let source;
    try {
      source = fs7.readFileSync(f.abs, "utf8");
    } catch {
      continue;
    }
    const hash = hashText(source);
    if (old && old.hash === hash) {
      entries[f.rel] = { ...old, size: st.size, mtimeMs: st.mtimeMs };
      words += old.words;
      continue;
    }
    const entry = { size: st.size, mtimeMs: st.mtimeMs, hash, words: source.split(/\s+/).length, extraction: null };
    words += entry.words;
    changed.push(f.rel);
    try {
      if (f.kind === "markdown") entry.extraction = extractMarkdown(f.rel, source, root, docs);
      else if (f.kind === "json") entry.extraction = extractJson(f.rel, source) ?? null;
      else entry.extraction = await extractCode(f.rel, source, languageForFile(f.rel), resolver);
    } catch (err2) {
      process.stderr.write(`faundr graph: falha ao ler ${f.rel}: ${err2.message}
`);
    }
    entries[f.rel] = entry;
  }
  saveCache(root, files, entries);
  const extractions = /* @__PURE__ */ new Map();
  for (const [rel, e] of Object.entries(entries)) if (e.extraction) extractions.set(rel, e.extraction);
  return { extractions, words, changed };
}
async function buildProjectGraph(root) {
  const started = Date.now();
  const files = collectFiles(root);
  const { extractions, words } = await extractAll(root, files);
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
    stats: { files: files.length, dropped: files.dropped, nodes: g.order, edges: g.size, communities: communities.size, ms: Date.now() - started }
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
  const dir2 = path14.join(root, OUT_DIR);
  fs7.mkdirSync(dir2, { recursive: true });
  fs7.writeFileSync(path14.join(dir2, "graph.json"), JSON.stringify(result.graph));
  fs7.writeFileSync(path14.join(dir2, "GRAPH_REPORT.md"), result.report);
}
async function refreshGraph(root) {
  const file = path14.join(root, OUT_DIR, "graph.json");
  if (!fs7.existsSync(file)) return null;
  const files = collectFiles(root);
  const { stale, setChanged } = staleFiles(root, files);
  if (!stale.length) return { changed: [] };
  const { extractions, changed } = await extractAll(root, files);
  if (!changed.length && !setChanged) return { changed: [] };
  const old = loadGraphJson(root);
  const oldById = new Map(old.nodes.map((n) => [n.id, n]));
  const { nodes, edges } = resolveCorpus(extractions);
  const g = buildGraph(nodes, edges);
  const communities = /* @__PURE__ */ new Map();
  const names = /* @__PURE__ */ new Map();
  g.forEachNode((id) => {
    const o = oldById.get(id);
    if (o?.community == null) return;
    communities.set(o.community, [...communities.get(o.community) ?? [], id]);
    names.set(o.community, o.community_name);
  });
  const graph = toGraphJson(g, communities, names, old.built_at_commit);
  graph.graph = { ...old.graph, refreshed_at: (/* @__PURE__ */ new Date()).toISOString() };
  fs7.writeFileSync(file, JSON.stringify(graph));
  return { changed: setChanged ? stale : changed };
}
function loadGraphJson(root) {
  const file = path14.join(root, OUT_DIR, "graph.json");
  if (!fs7.existsSync(file)) throw new Error("Grafo ainda n\xE3o gerado. Rode: faundr graph");
  return JSON.parse(fs7.readFileSync(file, "utf8"));
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
    const bare2 = nl.replace(/\(\)$/, "");
    const lt = tokens(a.label).join(" ");
    const src = (a.source_file ?? "").toLowerCase();
    let score = 0;
    if ([nl, bare2, lt, id.toLowerCase()].includes(joined)) score += 1e3 * 10 * joinedW;
    else if (joined && [nl, bare2, lt].some((x) => x.startsWith(joined))) score += 100 * 10 * joinedW;
    let tiered = 0;
    let matched = 0;
    for (const t of norm) {
      const w = idf.get(t);
      if (t === nl || t === bare2) tiered += 1e3 * w, matched++;
      else if (nl.startsWith(t) || bare2.startsWith(t) || lt.split(" ").some((x) => x.startsWith(t))) tiered += 100 * w, matched++;
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
function shortestPath(json, from, to, opts = {}) {
  const g = loadGraph(json);
  const a = findNode(g, from);
  const b = findNode(g, to);
  const src = a.id ?? a.ambiguous?.[0];
  const dst = b.id ?? b.ambiguous?.[0];
  if (!src) return `Nenhum n\xF3 encontrado para '${from}'.`;
  if (!dst) return `Nenhum n\xF3 encontrado para '${to}'.`;
  if (src === dst) return `'${from}' e '${to}' apontam para o mesmo n\xF3.`;
  const external = (id) => Boolean(g.getNodeAttribute(id, "external")) || !g.getNodeAttribute(id, "source_file");
  const keyOf = (s) => `${s.node}\0${s.dir}${s.flips}`;
  const walk = (undirected2) => {
    const start2 = { node: src, dir: "", flips: 0 };
    const prev = /* @__PURE__ */ new Map([[keyOf(start2), { step: start2, from: null, edge: "" }]]);
    const queue = [start2];
    while (queue.length) {
      const cur2 = queue.shift();
      for (const k of g.edges(cur2.node).sort()) {
        const e = g.getEdgeAttributes(k);
        const dir2 = e._src === cur2.node ? "f" : "b";
        if (!undirected2 && dir2 === "b") continue;
        if (undirected2 && e.confidence !== "EXTRACTED") continue;
        const flips = cur2.flips + (cur2.dir && cur2.dir !== dir2 ? 1 : 0);
        if (flips > 1) continue;
        const nb = g.opposite(cur2.node, k);
        if (nb !== dst && external(nb)) continue;
        const step = { node: nb, dir: dir2, flips };
        if (prev.has(keyOf(step))) continue;
        prev.set(keyOf(step), { step, from: cur2, edge: k });
        if (nb === dst) return { prev, end: step };
        queue.push(step);
      }
    }
    return null;
  };
  let undirected = Boolean(opts.undirected);
  let found = walk(undirected);
  if (!found && !undirected) {
    undirected = true;
    found = walk(true);
  }
  if (!found) return `Nenhum caminho entre '${from}' e '${to}' dentro do projeto. Pode haver uma liga\xE7\xE3o que o mapa n\xE3o enxerga, como import din\xE2mico ou chamada pela API.`;
  const note = undirected && !opts.undirected ? "Sem caminho na dire\xE7\xE3o de uso (quem chama \u2192 quem \xE9 chamado); este ignora a dire\xE7\xE3o uma vez.\n" : "";
  const hops = [];
  for (let s = found.end; s.node !== src || s.dir; ) {
    const p = found.prev.get(keyOf(s));
    hops.unshift({ node: s.node, key: p.edge });
    s = p.from;
  }
  let line2 = `  ${g.getNodeAttribute(src, "label")}`;
  let cur = src;
  for (const h of hops) {
    const e = g.getEdgeAttributes(h.key);
    line2 += e._src === cur ? ` --${e.relation} [${e.confidence}]--> ` : ` <--${e.relation} [${e.confidence}]-- `;
    line2 += g.getNodeAttribute(h.node, "label");
    cur = h.node;
  }
  return `${note}Caminho mais curto (${hops.length} saltos):
${line2}`;
}

// engine/src/quality-dart.ts
var BRANCHES = /* @__PURE__ */ new Set([
  "if_statement",
  "for_statement",
  "while_statement",
  "do_statement",
  "switch_statement_case",
  "switch_expression_case",
  "catch_clause",
  "conditional_expression",
  "logical_and_expression",
  "logical_or_expression",
  "if_null_expression",
  "if_element",
  "for_element"
]);
var NESTING = /* @__PURE__ */ new Set(["if_statement", "for_statement", "while_statement", "do_statement", "switch_statement", "try_statement"]);
var FUNCTIONS = /* @__PURE__ */ new Set(["function_expression", "local_function_declaration", "function_signature", "method_signature"]);
var PRINT = /^(print|debugPrint)\s*\(/;
var CHECKS = /\b(expect|expectLater|verify|verifyNever|verifyInOrder|expectAsync\d?)\s*\(/;
var statements = (block) => (block?.namedChildren ?? []).filter((n) => !n.type.endsWith("comment"));
var hasComment = (block) => (block?.namedChildren ?? []).some((n) => n.type.endsWith("comment"));
var isPrintOnly = (n) => n.type === "expression_statement" && PRINT.test(n.text);
var isEmptyReturn = (n) => n.type === "return_statement" && /^return\s*(null|false|\[\s*\]|\{\s*\}|''|""|const \[\s*\])?\s*;$/.test(n.text);
async function analyzeDart(source, { test = false } = {}) {
  const tree = await parse("dart", source);
  const hits = [];
  const functions = [];
  const add = (rule, node, ctx) => hits.push({ rule, line: node.startPosition.row + 1, ctx: { ...ctx, lang: "dart" } });
  const visit = (node) => {
    const t = node.type;
    if (test) {
      if (t === "expression_statement") testCall(node, add);
    } else {
      if (t === "try_statement") tryStatement(node, add);
      else if (t === "expression_statement" && PRINT.test(node.text)) add("limpeza/print-esquecido", node, { call: node.text.match(PRINT)[1] });
      else if (t === "expression_statement" && /^debugger\s*\(/.test(node.text)) add("limpeza/debugger", node, { call: "debugger()" });
      else if (t === "conditional_expression" && node.parent?.type !== "conditional_expression" && node.namedChildren.some((c) => c.type === "conditional_expression"))
        add("complexidade/ternario-aninhado", node);
      if (t === "function_signature" || t === "method_signature") fn(node, add, functions);
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(tree.rootNode);
  commentedCode(tree.rootNode, source.split("\n"), hits, { lang: "dart" });
  const module2 = { imports: [], exports: [], commonjs: false, lang: "dart" };
  for (const n of tree.rootNode.descendantsOfType(["import_or_export", "part_directive"])) {
    const uri = n.descendantsOfType("string_literal")[0]?.text.replace(/^['"]|['"]$/g, "");
    if (uri) module2.imports.push({ spec: uri, names: ["*"] });
  }
  tree.delete();
  return { hits, functions, module: module2 };
}
function tryStatement(node, add) {
  for (const c of node.namedChildren) {
    if (c.type !== "catch_clause") continue;
    const body2 = c.nextNamedSibling?.type === "block" ? c.nextNamedSibling : null;
    const list = statements(body2);
    if (!list.length) {
      if (!hasComment(body2)) add("falha/catch-vazio", c);
    } else if (list.every(isPrintOnly)) add("falha/catch-so-loga", c);
    else if (list.length === 1 && isEmptyReturn(list[0]) && !hasComment(body2)) add("falha/catch-devolve-nulo", c);
  }
}
function fn(node, add, functions) {
  if (node.type === "function_signature" && node.parent?.type === "method_signature") return;
  const body2 = node.nextNamedSibling?.type === "function_body" ? node.nextNamedSibling : null;
  if (!body2) return;
  const sig = node.type === "method_signature" ? node.namedChildren.find((c) => c.type.endsWith("_signature")) : node;
  const name2 = sig?.childForFieldName("name")?.text ?? sig?.namedChildren.find((c) => c.type === "identifier")?.text ?? "(an\xF4nima)";
  const metrics = measureBody(body2, { functions: FUNCTIONS, branch: (c) => BRANCHES.has(c.type), nests: (c) => NESTING.has(c.type) });
  const span2 = { startPosition: node.startPosition, endPosition: body2.endPosition };
  recordFunction(span2, name2, metrics, add, functions);
}
function testCall(node, add) {
  const m = node.text.match(/^(test|testWidgets|group)\s*\(\s*(['"])(.*?)\2/s);
  if (!m) return;
  const name2 = m[3].slice(0, 80);
  if (/\bsolo\s*:\s*true\b/.test(node.text)) return add("testes/only", node, { call: `${m[1]}(solo: true)` });
  if (/\bskip\s*:\s*(true|['"])/.test(node.text)) return add("testes/pulado", node, { call: `${m[1]}(skip: \u2026)` });
  if (m[1] !== "group" && !CHECKS.test(node.text)) add("testes/sem-conferencia", node, { name: name2 });
  if (/Future\.delayed\s*\(|\bsleep\s*\(/.test(node.text)) add("testes/espera-fixa", node, { call: "Future.delayed" });
}

// engine/src/quality-go.ts
var BRANCHES2 = /* @__PURE__ */ new Set(["if_statement", "for_statement", "expression_case", "type_case", "communication_case"]);
var NESTING2 = /* @__PURE__ */ new Set(["if_statement", "for_statement", "expression_switch_statement", "type_switch_statement", "select_statement"]);
var FUNCTIONS2 = /* @__PURE__ */ new Set(["func_literal"]);
var LOG_ONLY = /^(log\.(Print|Println|Printf)|fmt\.(Print|Println|Printf|Fprint\w*)|slog\.\w+|\w*[lL]og(ger)?\.\w+|println|print)\s*\(/;
var CHECKS2 = /\b\w+\.(Error|Errorf|Fatal|Fatalf|Fail|FailNow)\s*\(|\b(assert|require)\.\w+\s*\(|\bExpect\s*\(|\bΩ\s*\(/;
var HELPER = /\w\(\s*t\s*[,)]|,\s*t\s*\)/;
var ZERO = /^(nil|false|0|""|``|\w+\{\})$/;
var statements2 = (block) => (block?.namedChildren ?? []).filter((n) => n.type !== "comment");
var hasComment2 = (block) => (block?.namedChildren ?? []).some((n) => n.type === "comment");
async function analyzeGo(source, { test = false } = {}) {
  const tree = await parse("go", source);
  const hits = [];
  const functions = [];
  const add = (rule, node, ctx) => hits.push({ rule, line: node.startPosition.row + 1, ctx: { ...ctx, lang: "go" } });
  const isMain = tree.rootNode.namedChildren.find((c) => c.type === "package_clause")?.text.trim() === "package main";
  const visit = (node) => {
    const t = node.type;
    if (test) {
      if (t === "function_declaration" && /^Test[A-Z_]?/.test(node.childForFieldName("name")?.text ?? "")) testFunction(node, add);
    } else {
      if (t === "if_statement") errCheck(node, add);
      else if (t === "expression_statement") statement(node, isMain, add);
      if (t === "function_declaration" || t === "method_declaration") fn2(node, add, functions);
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(tree.rootNode);
  commentedCode(tree.rootNode, source.split("\n"), hits, { lang: "go" });
  const module2 = { imports: [], exports: [], commonjs: false, lang: "go" };
  tree.delete();
  return { hits, functions, module: module2 };
}
function statement(node, isMain, add) {
  const text = node.text;
  const builtin = text.match(/^(println|print)\s*\(/);
  if (builtin) return add("limpeza/print-esquecido", node, { call: `${builtin[1]}()` });
  const fmt = text.match(/^fmt\.(Print|Println|Printf)\s*\(/);
  if (fmt && !isMain) return add("limpeza/print-esquecido", node, { call: `fmt.${fmt[1]}()` });
  if (/^runtime\.Breakpoint\s*\(/.test(text)) add("limpeza/debugger", node, { call: "runtime.Breakpoint()" });
}
function errCheck(node, add) {
  const cond = node.childForFieldName("condition");
  if (cond?.type !== "binary_expression" || !/^\w*[eE]rr\w*\s*!=\s*nil$/.test(cond.text)) return;
  const body2 = node.childForFieldName("consequence");
  const list = statements2(body2);
  if (!list.length) return hasComment2(body2) ? void 0 : add("falha/catch-vazio", node);
  if (list.every((s) => s.type === "expression_statement" && LOG_ONLY.test(s.text))) return add("falha/catch-so-loga", node);
  const ret = list.length === 1 && list[0].type === "return_statement" ? list[0] : null;
  const values = ret?.namedChildren[0]?.namedChildren ?? [];
  if (ret && values.length && values.every((v) => ZERO.test(v.text)) && !hasComment2(body2)) add("falha/catch-devolve-nulo", node);
}
function fn2(node, add, functions) {
  const body2 = node.childForFieldName("body");
  if (!body2) return;
  const metrics = measureBody(body2, {
    functions: FUNCTIONS2,
    branch: (c) => BRANCHES2.has(c.type) || c.type === "binary_expression" && /^(&&|\|\|)$/.test(c.childForFieldName("operator")?.text ?? ""),
    nests: (c) => NESTING2.has(c.type)
  });
  recordFunction(node, node.childForFieldName("name")?.text ?? "(an\xF4nima)", metrics, add, functions);
}
function testFunction(node, add) {
  const name2 = node.childForFieldName("name")?.text ?? "Test";
  const body2 = node.childForFieldName("body")?.text ?? "";
  if (/\bt\.Skip(Now|f)?\s*\(/.test(body2)) return add("testes/pulado", node, { call: "t.Skip()" });
  if (!CHECKS2.test(body2) && !HELPER.test(body2)) add("testes/sem-conferencia", node, { name: name2.slice(0, 80) });
  if (/\btime\.Sleep\s*\(/.test(body2)) add("testes/espera-fixa", node, { call: "time.Sleep" });
}

// engine/src/quality-java.ts
var LOGGER = /^(\w*[lL]og(ger)?|LOG(GER)?|_logger|Log|Timber|Trace|Debug)\.\w+\s*\(/;
var operator = (n) => n.childForFieldName("operator")?.text ?? n.children.find((c) => !c.isNamed)?.text ?? "";
var LANGS = {
  java: {
    grammar: "java",
    branches: /* @__PURE__ */ new Set(["if_statement", "for_statement", "enhanced_for_statement", "while_statement", "do_statement", "switch_block_statement_group", "switch_rule", "catch_clause", "ternary_expression"]),
    logical: (n) => n.type === "binary_expression" && /^(&&|\|\|)$/.test(operator(n)),
    nesting: /* @__PURE__ */ new Set(["if_statement", "for_statement", "enhanced_for_statement", "while_statement", "do_statement", "switch_expression", "try_statement", "try_with_resources_statement"]),
    inner: /* @__PURE__ */ new Set(["lambda_expression", "method_declaration", "constructor_declaration", "class_body"]),
    functions: /* @__PURE__ */ new Set(["method_declaration", "constructor_declaration"]),
    catch: "catch_clause",
    ternary: "ternary_expression",
    print: /^System\.(out|err)\.(print|println|printf)\s*\(/,
    halt: null,
    logOnly: /^(System\.(out|err)\.\w+|\w+\.printStackTrace)\s*\(/,
    emptyReturn: /^return\s*(null|false|0|""|Collections\.empty\w*\(\)|List\.of\(\)|Optional\.empty\(\))?\s*;$/,
    main: /\bstatic\s+void\s+main\s*\(/,
    testMark: /@(Test|ParameterizedTest|RepeatedTest)\b/,
    skipMark: /@(Disabled|Ignore)\b/,
    checks: /\b(assert\w*|verify\w*|fail|expect\w*)\s*\(|assertThat|\.should\w*\(/,
    sleep: /\bThread\.sleep\s*\(/
  },
  kotlin: {
    grammar: "kotlin",
    branches: /* @__PURE__ */ new Set(["if_expression", "for_statement", "while_statement", "do_while_statement", "when_entry", "catch_block", "conjunction_expression", "disjunction_expression", "elvis_expression"]),
    logical: () => false,
    nesting: /* @__PURE__ */ new Set(["if_expression", "for_statement", "while_statement", "do_while_statement", "when_expression", "try_expression"]),
    inner: /* @__PURE__ */ new Set(["lambda_literal", "anonymous_function", "function_declaration", "class_body"]),
    functions: /* @__PURE__ */ new Set(["function_declaration"]),
    catch: "catch_block",
    ternary: null,
    print: /^(println|print)\s*\(/,
    halt: null,
    logOnly: /^(println|print|\w+\.printStackTrace)\s*\(/,
    emptyReturn: /^(return(@\w+)?\s*)?(null|false|0|""|emptyList\(\)|emptyMap\(\)|listOf\(\))$/,
    main: /^\s*fun\s+main\s*\(/m,
    testMark: /@(Test|ParameterizedTest)\b/,
    skipMark: /@(Disabled|Ignore)\b/,
    checks: /\b(assert\w*|verify\w*|fail|expect\w*)\s*[({]|\bshould\w*\b|assertThat/,
    sleep: /\bThread\.sleep\s*\(/
  },
  csharp: {
    grammar: "c_sharp",
    branches: /* @__PURE__ */ new Set(["if_statement", "for_statement", "for_each_statement", "while_statement", "do_statement", "switch_section", "switch_expression_arm", "catch_clause", "conditional_expression"]),
    logical: (n) => n.type === "binary_expression" && /^(&&|\|\||\?\?)$/.test(operator(n)),
    nesting: /* @__PURE__ */ new Set(["if_statement", "for_statement", "for_each_statement", "while_statement", "do_statement", "switch_statement", "try_statement"]),
    inner: /* @__PURE__ */ new Set(["lambda_expression", "anonymous_method_expression", "local_function_statement", "method_declaration"]),
    functions: /* @__PURE__ */ new Set(["method_declaration", "constructor_declaration", "local_function_statement"]),
    catch: "catch_clause",
    ternary: "conditional_expression",
    print: /^Console\.(Write|WriteLine)\s*\(/,
    halt: /^(System\.Diagnostics\.)?Debugger\.(Break|Launch)\s*\(/,
    logOnly: /^(Console\.\w+|Debug\.\w+|Trace\.\w+)\s*\(/,
    emptyReturn: /^return\s*(null|false|default|0|""|string\.Empty|Array\.Empty<[^>]*>\(\))?\s*;$/,
    main: /\bstatic\s+(async\s+)?(void|int|Task(<int>)?)\s+Main\s*\(/,
    testMark: /\[\s*(Fact|Theory|Test|TestMethod|TestCase)\b/,
    skipMark: /\[\s*(Fact|Theory)\s*\(\s*Skip\s*=|\[\s*(Ignore|Explicit)\b/,
    checks: /\bAssert\.\w+\s*\(|\.Should\w*\(|\.Verify\w*\(|\bExpect\s*\(|Assert\w*\s*\(/,
    sleep: /\b(Thread\.Sleep|Task\.Delay)\s*\(/
  }
};
var COMMENTS = /* @__PURE__ */ new Set(["comment", "line_comment", "block_comment", "multiline_comment"]);
async function analyzeTyped(lang, source, { test = false } = {}) {
  const rules = LANGS[lang];
  const tree = await parse(rules.grammar, source);
  const hits = [];
  const functions = [];
  const add = (rule, node, ctx) => hits.push({ rule, line: node.startPosition.row + 1, ctx: { ...ctx, lang } });
  const isMain = rules.main.test(source) || tree.rootNode.namedChildren.some((c) => c.type === "global_statement");
  const visit = (node) => {
    const t = node.type;
    if (test) {
      if (rules.functions.has(t) && rules.testMark.test(annotations(node))) testMethod(node, rules, add);
    } else {
      if (t === rules.catch) catchClause(node, rules, add);
      else if (isStatement(node)) statement2(node, rules, isMain, add);
      else if (t === rules.ternary && node.parent?.type !== t && node.namedChildren.some((c) => c.type === t)) add("complexidade/ternario-aninhado", node);
      if (rules.functions.has(t)) fn3(node, rules, add, functions);
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(tree.rootNode);
  commentedCode(tree.rootNode, source.split("\n"), hits, { lang });
  const module2 = { imports: [], exports: [], commonjs: false, lang };
  tree.delete();
  return { hits, functions, module: module2 };
}
var isStatement = (n) => n.type === "expression_statement" || n.type === "call_expression" && n.parent?.type === "statements";
function statement2(node, rules, isMain, add) {
  const text = node.text;
  const print = text.match(rules.print);
  if (print && !isMain) return add("limpeza/print-esquecido", node, { call: `${print[0].replace(/\s*\($/, "")}()` });
  const halt = rules.halt && text.match(rules.halt);
  if (halt) add("limpeza/debugger", node, { call: `${halt[0].replace(/\s*\($/, "")}()` });
}
function catchBody(node) {
  const block = node.childForFieldName("body") ?? node.namedChildren.find((c) => c.type === "statements") ?? null;
  const items = block?.type === "statements" && !block.namedChildCount && block.text.trim() ? [block] : block?.namedChildren ?? [];
  const comment2 = items.some((c) => COMMENTS.has(c.type)) || node.namedChildren.some((c) => COMMENTS.has(c.type));
  return { list: items.filter((c) => !COMMENTS.has(c.type)), comment: comment2 };
}
function catchClause(node, rules, add) {
  const { list, comment: comment2 } = catchBody(node);
  if (!list.length) return comment2 ? void 0 : add("falha/catch-vazio", node);
  const logs = (s) => rules.logOnly.test(s.text.trim()) || LOGGER.test(s.text.trim());
  if (list.every((s) => (isStatement(s) || s.type === "call_expression") && logs(s))) return add("falha/catch-so-loga", node);
  if (list.length === 1 && rules.emptyReturn.test(list[0].text.trim()) && !comment2) add("falha/catch-devolve-nulo", node);
}
function nameAndBody(node) {
  const name2 = node.childForFieldName("name")?.text ?? node.namedChildren.find((c) => c.type === "simple_identifier")?.text ?? "(an\xF4nima)";
  const body2 = node.childForFieldName("body") ?? node.namedChildren.find((c) => c.type === "function_body") ?? null;
  return { name: name2, body: body2 };
}
function fn3(node, rules, add, functions) {
  const { name: name2, body: body2 } = nameAndBody(node);
  if (!body2) return;
  const metrics = measureBody(body2, { functions: rules.inner, branch: (c) => rules.branches.has(c.type) || rules.logical(c), nests: (c) => rules.nesting.has(c.type) });
  recordFunction(node, name2, metrics, add, functions);
}
function annotations(node) {
  return node.namedChildren.filter((c) => c.type === "modifiers" || c.type === "attribute_list").map((c) => c.text).join(" ");
}
function testMethod(node, rules, add) {
  const { name: name2, body: body2 } = nameAndBody(node);
  const marks = annotations(node);
  const text = body2?.text ?? "";
  const skip = marks.match(rules.skipMark);
  if (skip) return add("testes/pulado", node, { call: skip[0].replace(/^\[\s*/, "").replace(/\s*\(.*$|\s*=$/, "") });
  if (!rules.checks.test(text) && !/expected\s*=/.test(marks)) add("testes/sem-conferencia", node, { name: name2.slice(0, 80) });
  const sleep = text.match(rules.sleep);
  if (sleep) add("testes/espera-fixa", node, { call: sleep[1] ?? sleep[0].replace(/\s*\($/, "") });
}

// engine/src/quality-php.ts
var BRANCHES3 = /* @__PURE__ */ new Set([
  "if_statement",
  "else_if_clause",
  "for_statement",
  "foreach_statement",
  "while_statement",
  "do_statement",
  "case_statement",
  "catch_clause",
  "conditional_expression",
  "match_conditional_expression"
]);
var LOGICAL = /^(&&|\|\||and|or|\?\?)$/i;
var NESTING3 = /* @__PURE__ */ new Set(["if_statement", "for_statement", "foreach_statement", "while_statement", "do_statement", "switch_statement", "try_statement", "match_expression"]);
var FUNCTIONS3 = /* @__PURE__ */ new Set(["anonymous_function_creation_expression", "anonymous_function", "arrow_function", "function_definition", "method_declaration"]);
var DUMP = /* @__PURE__ */ new Set(["var_dump", "print_r", "dump", "var_export"]);
var HALT = /* @__PURE__ */ new Set(["dd", "ddd", "xdebug_break"]);
var LOG_ONLY2 = /^(echo\b|print\b|error_log\s*\(|var_dump\s*\(|print_r\s*\(|dump\s*\()/;
var CHECKS3 = /\$this->(assert|expect)\w*\(|\bexpect\s*\(|\bself::assert\w*\(|->assert\w*\(|\bassert\w*\s*\(/;
var statements3 = (block) => (block?.namedChildren ?? []).filter((n) => n.type !== "comment");
var hasComment3 = (block) => (block?.namedChildren ?? []).some((n) => n.type === "comment");
var calleeName = (n) => n.type === "function_call_expression" ? n.childForFieldName("function")?.text ?? "" : "";
var isEmptyReturn2 = (n) => n.type === "return_statement" && /^return\s*(null|false|\[\s*\]|array\(\s*\)|''|""|0)?\s*;$/i.test(n.text);
async function analyzePhp(source, { test = false } = {}) {
  const tree = await parse("php", source);
  const hits = [];
  const functions = [];
  const add = (rule, node, ctx) => hits.push({ rule, line: node.startPosition.row + 1, ctx: { ...ctx, lang: "php" } });
  const visit = (node) => {
    const t = node.type;
    if (test) {
      if (t === "method_declaration" && /^test/i.test(node.childForFieldName("name")?.text ?? "")) testMethod2(node, add);
      else if (t === "function_call_expression" && /^(it|test)$/.test(calleeName(node))) pestTest(node, add);
    } else {
      if (t === "catch_clause") catchClause2(node, add);
      else if (t === "function_call_expression" && DUMP.has(calleeName(node).toLowerCase())) add("limpeza/print-esquecido", node, { call: `${calleeName(node)}()` });
      else if (t === "function_call_expression" && HALT.has(calleeName(node).toLowerCase())) add("limpeza/debugger", node, { call: `${calleeName(node)}()` });
      else if (t === "conditional_expression" && node.parent?.type !== "conditional_expression" && node.namedChildren.some((c) => c.type === "conditional_expression"))
        add("complexidade/ternario-aninhado", node);
      if (t === "function_definition" || t === "method_declaration") fn4(node, add, functions);
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(tree.rootNode);
  commentedCode(tree.rootNode, source.split("\n"), hits, { lang: "php" });
  const module2 = phpModule(tree.rootNode);
  tree.delete();
  return { hits, functions, module: module2 };
}
function phpModule(root) {
  const m = { imports: [], exports: [], commonjs: false, lang: "php" };
  for (const n of root.descendantsOfType("namespace_use_clause")) {
    const name2 = n.namedChildren.find((c) => c.type === "qualified_name" || c.type === "name")?.text;
    if (name2) m.imports.push({ spec: `class:${name2}`, names: ["*"] });
  }
  for (const g of root.descendantsOfType("namespace_use_group")) {
    const prefix = g.parent?.namedChildren.find((c) => c.type === "namespace_name")?.text ?? "";
    for (const c of g.namedChildren) {
      const name2 = c.namedChildren.find((x) => x.type === "namespace_name" || x.type === "name")?.text;
      if (name2) m.imports.push({ spec: `class:${prefix}\\${name2}`, names: ["*"] });
    }
  }
  for (const n of root.descendantsOfType(["require_expression", "require_once_expression", "include_expression", "include_once_expression"])) {
    const raw = n.descendantsOfType(["string", "encapsed_string"])[0]?.text.replace(/^['"]|['"]$/g, "");
    if (raw && /\.php$/i.test(raw)) m.imports.push({ spec: `file:${raw.replace(/^\//, "")}`, names: ["*"] });
  }
  return m;
}
function catchClause2(node, add) {
  const body2 = node.childForFieldName("body");
  const list = statements3(body2);
  if (!list.length) return hasComment3(body2) ? void 0 : add("falha/catch-vazio", node);
  if (list.every((s) => s.type === "echo_statement" || s.type === "expression_statement" && LOG_ONLY2.test(s.text))) return add("falha/catch-so-loga", node);
  if (list.length === 1 && isEmptyReturn2(list[0]) && !hasComment3(body2)) add("falha/catch-devolve-nulo", node);
}
function fn4(node, add, functions) {
  const body2 = node.childForFieldName("body");
  if (!body2) return;
  const metrics = measureBody(body2, {
    functions: FUNCTIONS3,
    branch: (c) => BRANCHES3.has(c.type) || c.type === "binary_expression" && LOGICAL.test(c.childForFieldName("operator")?.text ?? ""),
    nests: (c) => NESTING3.has(c.type)
  });
  recordFunction(node, node.childForFieldName("name")?.text ?? "(an\xF4nima)", metrics, add, functions);
}
function testMethod2(node, add) {
  const name2 = node.childForFieldName("name")?.text ?? "test";
  const body2 = node.childForFieldName("body")?.text ?? "";
  if (/markTestSkipped|markTestIncomplete/.test(body2)) return add("testes/pulado", node, { call: "markTestSkipped()" });
  if (!CHECKS3.test(body2) && !/expectException/.test(body2)) add("testes/sem-conferencia", node, { name: name2.slice(0, 80) });
  if (/\b(u?sleep)\s*\(/.test(body2)) add("testes/espera-fixa", node, { call: "sleep()" });
}
function pestTest(node, add) {
  const text = node.text;
  const name2 = text.match(/^\w+\s*\(\s*(['"])(.*?)\1/s)?.[2] ?? calleeName(node);
  const chained = node.parent?.type === "member_call_expression" ? node.parent.text : "";
  if (/->skip\s*\(/.test(chained)) return add("testes/pulado", node, { call: "->skip()" });
  if (/->only\s*\(/.test(chained)) return add("testes/only", node, { call: "->only()" });
  if (!CHECKS3.test(text)) add("testes/sem-conferencia", node, { name: name2.slice(0, 80) });
}

// engine/src/quality-python.ts
var BRANCHES4 = /* @__PURE__ */ new Set(["if_statement", "elif_clause", "for_statement", "while_statement", "except_clause", "conditional_expression", "case_clause", "boolean_operator", "if_clause"]);
var NESTING4 = /* @__PURE__ */ new Set(["if_statement", "for_statement", "while_statement", "try_statement", "with_statement", "match_statement"]);
var FUNCTIONS4 = /* @__PURE__ */ new Set(["function_definition", "lambda"]);
var MOCK_MODULE = /(^|\.)(mocks?|fixtures?|fakes?|stubs?)(\.|$)/i;
var CHECKS4 = /\bassert\b|pytest\.(raises|warns|approx|fail)\b|self\.assert\w*\(|\.assert_\w+\(|\bexpect\(/;
var statements4 = (block) => (block?.namedChildren ?? []).filter((n) => n.type !== "comment");
var hasComment4 = (block) => (block?.namedChildren ?? []).some((n) => n.type === "comment");
var blockOf = (node) => node.namedChildren.filter((c) => c.type === "block").at(-1) ?? null;
var callee = (n) => n?.type === "call" ? n.childForFieldName("function")?.text ?? "" : "";
var isPrintOnly2 = (n) => n.type === "expression_statement" && callee(n.namedChildren[0]) === "print";
var isEmptyValue = (n) => !n || ["none", "false"].includes(n.type) || /^(\[\s*\]|\{\s*\}|\(\s*\)|""|''|0)$/.test(n.text);
async function analyzePython(source, { test = false } = {}) {
  const tree = await parse("python", source);
  const hits = [];
  const functions = [];
  const add = (rule, node, ctx) => hits.push({ rule, line: node.startPosition.row + 1, ctx: { ...ctx, py: 1 } });
  const visit = (node) => {
    const t = node.type;
    if (test) {
      if (t === "function_definition" && /^test/.test(node.childForFieldName("name")?.text ?? "")) testFunction2(node, add);
      if (t === "call" && /^(time\.)?sleep$/.test(callee(node))) add("testes/espera-fixa", node, { call: "time.sleep" });
    } else {
      if (t === "except_clause") exceptClause(node, add);
      else if (t === "call" && /^(breakpoint|i?pdb\.set_trace)$/.test(callee(node))) add("limpeza/debugger", node, { call: `${callee(node)}()` });
      else if (t === "conditional_expression" && node.parent?.type !== "conditional_expression" && hasNestedConditional(node)) add("complexidade/ternario-aninhado", node);
      else if (t === "import_from_statement") {
        const from = node.childForFieldName("module_name")?.text ?? "";
        if (MOCK_MODULE.test(from)) add("falha/mock-em-producao", node, { from });
      }
      if (t === "function_definition") fn5(node, add, functions);
    }
    for (const child of node.namedChildren) visit(child);
  };
  visit(tree.rootNode);
  commentedCode2(tree.rootNode, source.split("\n"), hits);
  const module2 = pythonModule(tree.rootNode);
  tree.delete();
  return { hits, functions, module: module2 };
}
function pythonModule(root) {
  const m = { imports: [], exports: [], commonjs: false, lang: "py" };
  for (const n of root.namedChildren) {
    if (n.type === "import_statement") {
      for (const d of n.namedChildren) m.imports.push({ spec: `0:${(d.type === "aliased_import" ? d.childForFieldName("name") : d)?.text ?? ""}`, names: ["*"] });
    } else if (n.type === "import_from_statement") {
      const text = n.childForFieldName("module_name")?.text ?? "";
      const level = text.match(/^\.*/)[0].length;
      const names = n.childrenForFieldName("name").map((d) => (d.type === "aliased_import" ? d.childForFieldName("name") : d)?.text ?? "");
      m.imports.push({ spec: `${level}:${text.slice(level)}`, names: n.namedChildren.some((c) => c.type === "wildcard_import") ? ["*"] : names });
      for (const name2 of names) m.imports.push({ spec: `${level}:${[text.slice(level), name2].filter(Boolean).join(".")}`, names: ["*"] });
    } else if ((n.type === "function_definition" || n.type === "class_definition") && !/^_/.test(n.childForFieldName("name")?.text ?? "_")) {
      m.exports.push({ name: n.childForFieldName("name").text, line: n.startPosition.row + 1 });
    }
  }
  return m;
}
function exceptClause(node, add) {
  const body2 = blockOf(node);
  const list = statements4(body2);
  const explained = hasComment4(body2) || hasComment4(node);
  if (list.every((s) => s.type === "pass_statement")) return explained ? void 0 : add("falha/catch-vazio", node);
  if (list.every(isPrintOnly2)) return add("falha/catch-so-loga", node);
  if (list.length === 1 && list[0].type === "return_statement" && isEmptyValue(list[0].namedChildren[0]) && !explained) add("falha/catch-devolve-nulo", node);
}
var unwrap2 = (n) => {
  while (n?.type === "parenthesized_expression") n = n.namedChildren[0];
  return n;
};
var hasNestedConditional = (node) => node.namedChildren.some((c) => unwrap2(c)?.type === "conditional_expression");
function testFunction2(node, add) {
  const name2 = node.childForFieldName("name")?.text ?? "test";
  const decorated = node.parent?.type === "decorated_definition" ? node.parent : null;
  const skip = decorated?.namedChildren.find((d) => d.type === "decorator" && /pytest\.mark\.(skip|skipif|xfail)\b|unittest\.skip/.test(d.text));
  if (skip) return add("testes/pulado", skip, { call: skip.text.replace(/\(.*$/s, "").slice(0, 40) });
  const body2 = node.childForFieldName("body");
  if (body2 && /\bpytest\.skip\(/.test(body2.text)) return add("testes/pulado", node, { call: "pytest.skip()" });
  if (body2 && !CHECKS4.test(body2.text)) add("testes/sem-conferencia", node, { name: name2.slice(0, 80) });
}
function fn5(node, add, functions) {
  const body2 = node.childForFieldName("body");
  if (!body2) return;
  const metrics = measureBody(body2, { functions: FUNCTIONS4, branch: (c) => BRANCHES4.has(c.type), nests: (c) => NESTING4.has(c.type) });
  recordFunction(node, node.childForFieldName("name")?.text ?? "(an\xF4nima)", metrics, add, functions);
}
var CODE_LINE = /^\s*(def|class|import|from|return|if|elif|else|for|while|try|except|with|raise|yield|print|await|async)\b|^\s*[\w.[\]]+\s*=[^=]|^\s*[\w.]+\(.*\)\s*$/;
function commentedCode2(root, lines, hits) {
  let run2 = null;
  let lastRow = -2;
  const flush = () => {
    if (run2 && run2.code >= 4 && run2.code / run2.total >= 0.75) hits.push({ rule: "demais/codigo-comentado", line: run2.start + 1, ctx: { lines: run2.total, py: 1 } });
    run2 = null;
  };
  const visit = (n) => {
    for (const c of n.namedChildren) {
      const row = c.startPosition.row;
      const alone = !(lines[row] ?? "").slice(0, c.startPosition.column).trim();
      if (c.type === "comment" && alone && !c.text.startsWith("#!")) {
        if (row !== lastRow + 1) flush();
        run2 ??= { start: row, code: 0, total: 0 };
        run2.total++;
        const body2 = c.text.replace(/^#\s?/, "");
        if (CODE_LINE.test(body2) && !/faundr-ignore|noqa|type:\s*ignore|pragma/.test(body2)) run2.code++;
        lastRow = row;
      } else visit(c);
    }
  };
  visit(root);
  flush();
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
  ".cjs": "javascript",
  ".py": "python",
  ".dart": "dart",
  ".php": "php",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".cs": "c_sharp"
};
var FUNCTIONS5 = /* @__PURE__ */ new Set([
  "function_declaration",
  "function_expression",
  "function",
  "generator_function_declaration",
  "generator_function",
  "arrow_function",
  "method_definition"
]);
var BRANCHES5 = /* @__PURE__ */ new Set([
  "if_statement",
  "for_statement",
  "for_in_statement",
  "while_statement",
  "do_statement",
  "catch_clause",
  "ternary_expression"
]);
var NESTING5 = /* @__PURE__ */ new Set(["if_statement", "for_statement", "for_in_statement", "while_statement", "do_statement", "switch_statement", "try_statement"]);
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
  if (grammar === "python") return analyzePython(source, { test });
  if (grammar === "dart") return analyzeDart(source, { test });
  if (grammar === "php") return analyzePhp(source, { test });
  if (grammar === "go") return analyzeGo(source, { test });
  if (grammar === "java" || grammar === "kotlin") return analyzeTyped(grammar, source, { test });
  if (grammar === "c_sharp") return analyzeTyped("csharp", source, { test });
  const tree = await parse(grammar, source);
  const hits = [];
  const functions = [];
  const add = (rule, node, ctx) => hits.push({ rule, line: node.startPosition.row + 1, ctx });
  let nonNull = 0;
  const visit = (node) => {
    const t = node.type;
    if (test) {
      if (t === "call_expression") testCall2(node, add);
    } else if (t === "non_null_expression") nonNull++;
    else productionNode(node, add, functions);
    if (t === "comment") comment(node, add);
    trackModule(node, module2);
    for (const child of node.namedChildren) visit(child);
  };
  visit(tree.rootNode);
  if (nonNull >= LIMITS.nonNull) hits.push({ rule: "tipos/non-null-em-excesso", line: 1, ctx: { count: nonNull } });
  commentedCode(tree.rootNode, source.split("\n"), hits);
  tree.delete();
  return { hits, functions, module: module2 };
}
function productionNode(node, add, functions) {
  const t = node.type;
  if (t === "catch_clause") catchClause3(node, add);
  else if (t === "call_expression") call(node, add);
  else if (t === "debugger_statement") add("limpeza/debugger", node);
  else if (t === "predefined_type" && node.text === "any") {
    add(node.parent?.type === "as_expression" ? "tipos/as-any" : "tipos/any", node);
  } else if (t === "ternary_expression" && !isTernaryChild(node) && hasNestedTernary(node)) add("complexidade/ternario-aninhado", node);
  else if (t === "import_statement") {
    const from = node.childForFieldName("source")?.text.slice(1, -1) ?? "";
    if (MOCK_IMPORT.test(from)) add("falha/mock-em-producao", node, { from });
  }
  if (FUNCTIONS5.has(t)) fn6(node, add, functions);
}
function trackModule(node, module2) {
  const t = node.type;
  if (t === "import_statement" || t === "export_statement") moduleEdge(node, module2);
  else if (t === "call_expression") dynamicImport(node, module2);
  else if (t === "member_expression" && /^(module\.exports|exports\.\w+)$/.test(node.text)) module2.commonjs = true;
}
var statements5 = (block) => (block?.namedChildren ?? []).filter((n) => n.type !== "comment");
var hasComment5 = (block) => (block?.namedChildren ?? []).some((n) => n.type === "comment");
var isConsoleCall = (n) => n.type === "expression_statement" && n.namedChildren[0]?.type === "call_expression" && /^console\.\w+$/.test(n.namedChildren[0].childForFieldName("function")?.text ?? "");
var isEmptyValue2 = (n) => !n || ["null", "undefined", "false"].includes(n.type) || n.text === "undefined" || /^(\[\s*\]|\{\s*\})$/.test(n.text);
function catchClause3(node, add) {
  const body2 = node.childForFieldName("body");
  const list = statements5(body2);
  if (!list.length) return hasComment5(body2) ? void 0 : add("falha/catch-vazio", node);
  if (list.every(isConsoleCall)) return add("falha/catch-so-loga", node);
  if (list.length === 1 && list[0].type === "return_statement" && isEmptyValue2(list[0].namedChildren[0]) && !hasComment5(body2))
    add("falha/catch-devolve-nulo", node);
}
function call(node, add) {
  const callee2 = node.childForFieldName("function");
  if (!callee2) return;
  if (callee2.type === "member_expression" && callee2.childForFieldName("property")?.text === "catch") {
    const handler = node.childForFieldName("arguments")?.namedChildren[0];
    if (handler && (handler.type === "arrow_function" || handler.type === "function_expression" || handler.type === "function")) {
      const body2 = handler.childForFieldName("body");
      if (body2?.type === "statement_block") {
        if (!statements5(body2).length && !hasComment5(body2)) add("falha/catch-vazio", node);
      } else if (isEmptyValue2(body2)) add("falha/catch-devolve-nulo", node);
    }
  }
  if (/^console\.(log|debug)$/.test(callee2.text)) add("limpeza/console-log", node);
}
var CHECKS5 = /\b(expect|assert)\b|\.should\b|\bt\.(is|true|false|deepEqual|throws)\b|toMatch(Inline)?Snapshot/;
function testCall2(node, add) {
  const callee2 = node.childForFieldName("function")?.text ?? "";
  if (/(^|\.)waitForTimeout$/.test(callee2) || callee2 === "setTimeout" && /^\d+$/.test(node.childForFieldName("arguments")?.namedChildren[1]?.text ?? ""))
    add("testes/espera-fixa", node, { call: callee2 });
  const m = callee2.match(/^(it|test|describe|context)\.(skip|only|todo)$/) ?? callee2.match(/^(x|f)(it|describe|test)$/);
  if (m) {
    const only = m[2] === "only" || m[1] === "f";
    add(only ? "testes/only" : "testes/pulado", node, { call: callee2 });
    return;
  }
  if (!/^(it|test)(\.(concurrent|serial))?$/.test(callee2)) return;
  const args2 = node.childForFieldName("arguments")?.namedChildren ?? [];
  const body2 = args2.find((a) => FUNCTIONS5.has(a.type));
  const name2 = args2[0]?.type === "string" || args2[0]?.type === "template_string" ? args2[0].text.slice(1, -1) : callee2;
  if (body2 && !CHECKS5.test(body2.text)) add("testes/sem-conferencia", node, { name: name2.slice(0, 80) });
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
function fn6(node, add, functions) {
  const body2 = node.childForFieldName("body");
  if (!body2) return;
  const metrics = measureBody(body2, {
    functions: FUNCTIONS5,
    branch: (c) => BRANCHES5.has(c.type) || c.type === "switch_case" || c.type === "binary_expression" && /^(&&|\|\|)$/.test(c.childForFieldName("operator")?.text ?? ""),
    // else if não aprofunda.
    nests: (c) => NESTING5.has(c.type) && !(c.type === "if_statement" && c.parent?.type === "else_clause")
  });
  recordFunction(node, functionName(node), metrics, add, functions);
}
function measureBody(body2, rules) {
  let complexity = 1;
  let deepest = { depth: 0, node: body2 };
  const walk = (n, depth) => {
    for (const c of n.namedChildren) {
      if (rules.functions.has(c.type)) continue;
      let d = depth;
      if (rules.branch(c)) complexity++;
      if (rules.nests(c)) {
        d = depth + 1;
        if (d > deepest.depth) deepest = { depth: d, node: c };
      }
      walk(c, d);
    }
  };
  walk(body2, 0);
  return { complexity, deepest };
}
function recordFunction(node, name2, { complexity, deepest }, add, functions) {
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
var CODE_LINE2 = /[;{}]\s*$|^\s*(const|let|var|if|for|while|return|import|export|function|await|async|try|catch|switch|case|throw|class|func|fun|val|defer|public|private|protected)\b|^\s*[\w.$\]]+\s*\(.*\)\s*;?\s*$|^\s*[\w.$]+\s*=[^=]|^\s*[\w, ]+\s*:=|^\s*<\/?[A-Za-z][\w.]*[\s>/]/;
function commentedCode(root, lines, hits, extra = {}) {
  let run2 = null;
  let lastRow = -2;
  const flush = () => {
    if (run2 && run2.code >= 4 && run2.code / run2.total >= 0.75) hits.push({ rule: "demais/codigo-comentado", line: run2.start + 1, ctx: { lines: run2.total, ...extra } });
    run2 = null;
  };
  const visit = (n) => {
    for (const c of n.namedChildren) {
      const row = c.startPosition.row;
      const alone = !(lines[row] ?? "").slice(0, c.startPosition.column).trim();
      if ((c.type === "comment" || c.type === "line_comment") && alone && c.text.startsWith("//") && !c.text.startsWith("///")) {
        if (row !== lastRow + 1) flush();
        run2 ??= { start: row, code: 0, total: 0 };
        run2.total++;
        const body2 = c.text.slice(2);
        if (CODE_LINE2.test(body2) && !/faundr-ignore|eslint|@ts-|prettier-ignore/.test(body2)) run2.code++;
        lastRow = row;
      } else visit(c);
    }
  };
  visit(root);
  flush();
}
var unquote = (n) => n ? n.text.slice(1, -1) : "";
var exportedName = (spec) => (spec.childForFieldName("alias") ?? spec.childForFieldName("name"))?.text ?? "";
function importedNames(node) {
  const names = [];
  for (const part of node.namedChildren.find((c) => c.type === "import_clause")?.namedChildren ?? []) {
    if (part.type === "identifier") names.push("default");
    else if (part.type === "namespace_import") names.push("*");
    else if (part.type === "named_imports") names.push(...namedImports(part));
  }
  return names;
}
var namedImports = (part) => part.namedChildren.filter((spec) => spec.type === "import_specifier").map((spec) => spec.childForFieldName("name")?.text ?? "");
function moduleEdge(node, m) {
  const source = node.childForFieldName("source");
  if (node.type === "import_statement") {
    m.imports.push({ spec: unquote(source), names: importedNames(node) });
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
  const callee2 = node.childForFieldName("function");
  if (callee2?.type !== "import" && callee2?.text !== "require") return;
  const arg = node.childForFieldName("arguments")?.namedChildren[0];
  if (arg?.type === "string") m.imports.push({ spec: unquote(arg), names: ["*"] });
}
function resolveImport(resolver, lang, spec, rel) {
  if (lang === "py") {
    const at = spec.indexOf(":");
    return resolver.resolvePython(spec.slice(at + 1), Number(spec.slice(0, at)), rel);
  }
  if (lang === "dart") return resolver.resolveDart(spec, rel);
  if (lang === "php") return spec.startsWith("class:") ? resolver.resolvePhpClass(spec.slice(6)) : resolver.resolveRelativeFile(spec.slice(5), rel);
  return resolver.resolveJs(spec, rel);
}
var PACKAGE_LANGS = /* @__PURE__ */ new Set(["go", "java", "kotlin", "csharp"]);
function unusedCode(root, modules, texts, entry) {
  const resolver = new PathResolver(root);
  const importedBy = /* @__PURE__ */ new Map();
  const usedNames = /* @__PURE__ */ new Map();
  for (const [rel, m] of modules)
    for (const imp of m.imports) {
      const target = resolveImport(resolver, m.lang, imp.spec, rel);
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
  const exports = [];
  for (const [rel, m] of modules) {
    if (entry(rel) || PACKAGE_LANGS.has(m.lang ?? "")) continue;
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
      exports.push({ file: rel, name: e.name, line: e.line });
    }
  }
  return { orphans, exports };
}

// engine/src/search.ts
import fs8 from "node:fs";
import path15 from "node:path";
var strip2 = (s) => s.normalize("NFKD").replace(new RegExp("\\p{M}+", "gu"), "");
function wordsOf(text) {
  const split = strip2(text).replace(new RegExp("([\\p{Ll}\\p{N}])(\\p{Lu})", "gu"), "$1 $2").replace(new RegExp("(\\p{Lu}+)(\\p{Lu}\\p{Ll})", "gu"), "$1 $2").toLowerCase();
  return (split.match(/[\p{L}\p{N}]+/gu) ?? []).map(stem);
}
var stem = (w) => w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
var STOPWORDS2 = new Set(
  "the and for with that this what where when which who how why does into from about are was were been have has had can could should would will not but all any our your their there here then than them they its also just only onde como qual quai quem quando porque para por com que uma uns dos das nos nas pelo pela isso isto esse essa este esta ele ela eles elas seu sua seus suas tem ter foi ser sao esta estao fazer faz vai vao fica ficam pra pro sobre entre cada todo toda todos todas depois antes agora ainda muito mais menos quero preciso existe existem acontece funciona aqui ali la tipo coisa coisas codigo code arquivo file fica".split(/\s+/)
);
var PT_EN = {
  usuario: ["user"],
  projeto: ["project"],
  sessao: ["session"],
  sessoe: ["session"],
  erro: ["error"],
  senha: ["password"],
  chave: ["key", "secret"],
  grafo: ["graph"],
  cupom: ["coupon"],
  cupon: ["coupon"],
  frete: ["shipping"],
  carrinho: ["cart"],
  pedido: ["order"],
  teste: ["test"],
  regra: ["rule"],
  tarefa: ["task"],
  funcionalidade: ["feature"],
  decisao: ["decision"],
  memoria: ["memory"],
  painel: ["panel", "dashboard"],
  convite: ["invite"],
  organizacao: ["org", "organization"],
  seguranca: ["security"],
  qualidade: ["quality"],
  banco: ["db", "database"],
  tela: ["screen", "page", "view"],
  rota: ["route"],
  enviar: ["send", "upload"],
  envia: ["send", "upload"],
  salvar: ["save"],
  salva: ["save"],
  apagar: ["delete"],
  apaga: ["delete"],
  criar: ["create"],
  cria: ["create"],
  buscar: ["fetch", "search", "query"],
  busca: ["search", "query"],
  ler: ["read", "load"],
  le: ["read", "load"],
  mostrar: ["show", "render"],
  mostra: ["show", "render"],
  uso: ["usage"],
  aplicar: ["apply"],
  aplica: ["apply"],
  calcular: ["calc", "compute"],
  calcula: ["calc", "compute"],
  custo: ["cost"],
  preco: ["price"],
  valor: ["value", "total"],
  desconto: ["discount"],
  entrar: ["login", "signin"],
  sair: ["logout"],
  conta: ["account"],
  pagamento: ["payment"],
  nota: ["note"],
  comentario: ["comment"],
  aviso: ["warning", "notice"],
  evento: ["event"],
  configuracao: ["config", "setting"],
  dono: ["owner"],
  membro: ["member"],
  papel: ["role"],
  permissao: ["permission"],
  arquivo: ["file"],
  pasta: ["dir", "folder"],
  comando: ["command"],
  resumo: ["summary"],
  relatorio: ["report"],
  achado: ["finding"],
  gancho: ["hook"],
  bloquear: ["block", "guard"],
  bloqueia: ["block", "guard"],
  lista: ["list"],
  listar: ["list"],
  atualizar: ["update", "refresh"],
  atualiza: ["update", "refresh"],
  data: ["date"],
  hora: ["time"],
  tempo: ["time", "duration"],
  token: ["token"],
  login: ["login"],
  cache: ["cache"]
};
var TEST_PATH = /(^|\/)(tests?|__tests__|spec|e2e)\/|\.(test|spec)\.\w+$/;
var ASKS_TESTS = /\b(test|teste|spec)\b/;
var ASKS_DOCS = /\b(doc|docs|documento|documentacao|readme|guia|md)\b/;
var WEIGHT = { name: 3, path: 2, body: 1 };
var K1 = 1.2;
var B = 0.75;
var BODY_LINES = 300;
function queryGroups(question) {
  const all = wordsOf(question);
  const kept = all.filter((w) => !STOPWORDS2.has(w) && (w.length > 1 || /\d/.test(w)));
  return [...new Set(kept.length ? kept : all)].map((w) => [w, ...(PT_EN[w] ?? []).filter((t) => t !== w)]);
}
var MAX_LINE_CHARS = 2e3;
var SourceCache = class {
  constructor(root) {
    this.root = root;
  }
  root;
  files = /* @__PURE__ */ new Map();
  lines(rel) {
    if (!this.files.has(rel)) {
      try {
        const lines = fs8.readFileSync(path15.join(this.root, rel), "utf8").split(/\r?\n/);
        this.files.set(rel, lines.map((l) => l.length > MAX_LINE_CHARS ? `${l.slice(0, MAX_LINE_CHARS)}\u2026` : l));
      } catch {
        this.files.set(rel, null);
      }
    }
    return this.files.get(rel);
  }
};
var lineOf = (loc) => loc && /^L\d+/.test(loc) ? Number(loc.slice(1)) : 0;
var isFileNode2 = (n) => !!n.source_file && n.id === fileNodeId(n.source_file);
var nameOf = (n) => n.label.replace(/\(\)$/, "").replace(/^\./, "");
var FIELDS = ["name", "path", "body"];
function rankNodes(json, question, src) {
  const groups = queryGroups(question);
  if (!groups.length) return [];
  const q = strip2(question).toLowerCase();
  const wants = { tests: ASKS_TESTS.test(q), docs: ASKS_DOCS.test(q) };
  const docs = searchDocs(json, src);
  const bm25 = bm25Scorer(docs);
  const degree = inboundDegree(json);
  const phrase = groups.map((g) => g[0]).join(" ");
  const hits = [];
  for (const { n, fields } of docs) {
    let score = 0;
    let matched = 0;
    for (const [word, ...translations] of groups) {
      const s = bm25(fields, word) + 0.6 * translations.reduce((t, w) => t + bm25(fields, w), 0);
      if (s) score += s, matched++;
    }
    if (!score) continue;
    const coverage = matched / groups.length;
    score *= 0.4 + 0.6 * coverage;
    if (fields.name.join(" ") === phrase) score *= 2;
    hits.push({ node: n, score: adjustScore(n, score, wants, degree) });
  }
  return hits.sort((a, b) => b.score - a.score || a.node.label.length - b.node.label.length || a.node.id.localeCompare(b.node.id));
}
function adjustScore(n, score, wants, degree) {
  if (TEST_PATH.test(n.source_file) && !wants.tests) score *= 0.4;
  if (n.file_type !== "code" && !wants.docs) score *= 0.5;
  if (isFileNode2(n)) score *= 0.8;
  return score * (1 + 0.1 * Math.log(1 + (degree.get(n.id) ?? 0)));
}
function searchDocs(json, src) {
  return json.nodes.filter((n) => n.source_file && !n.external).map((n) => {
    const fields = { name: wordsOf(nameOf(n)), path: wordsOf(n.source_file), body: [] };
    const start2 = lineOf(n.source_location);
    const end = lineOf(n.end_location);
    if (src && n.file_type === "code" && !isFileNode2(n) && start2 && end >= start2) {
      const lines = src.lines(n.source_file);
      if (lines) fields.body = wordsOf(lines.slice(start2 - 1, Math.min(end, start2 - 1 + BODY_LINES)).join("\n"));
    }
    return { n, fields };
  });
}
function inboundDegree(json) {
  const degree = /* @__PURE__ */ new Map();
  for (const l of json.links) {
    if (l.relation === "calls" || l.relation === "imports" || l.relation === "imports_from" || l.relation === "indirect_call") {
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    }
  }
  return degree;
}
function bm25Scorer(docs) {
  const stats = {};
  for (const f of FIELDS) {
    const df = /* @__PURE__ */ new Map();
    let total = 0;
    for (const d of docs) {
      total += d.fields[f].length;
      for (const w of new Set(d.fields[f])) df.set(w, (df.get(w) ?? 0) + 1);
    }
    stats[f] = { avg: total / Math.max(1, docs.length) || 1, df };
  }
  const N = docs.length;
  return (fields, w) => {
    let total = 0;
    for (const f of FIELDS) {
      const words = fields[f];
      const tf = words.reduce((c, x) => c + (x === w ? 1 : 0), 0);
      if (!tf) continue;
      const df = stats[f].df.get(w) ?? 0;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      total += WEIGHT[f] * idf * (tf * (K1 + 1) / (tf + K1 * (1 - B + B * words.length / stats[f].avg)));
    }
    return total;
  };
}
function neighbors(json) {
  const byId = new Map(json.nodes.map((n) => [n.id, n]));
  const incoming = /* @__PURE__ */ new Map();
  const outgoing = /* @__PURE__ */ new Map();
  for (const l of json.links) {
    ;
    (incoming.get(l.target) ?? incoming.set(l.target, []).get(l.target)).push(l);
    (outgoing.get(l.source) ?? outgoing.set(l.source, []).get(l.source)).push(l);
  }
  return { byId, incoming, outgoing };
}
var CALLS = /* @__PURE__ */ new Set(["calls", "indirect_call"]);
function KIND_LABEL(n) {
  if (n.file_type === "document") return "documento";
  if (isFileNode2(n)) return "arquivo";
  if (n.label.startsWith(".")) return "m\xE9todo";
  return n.label.endsWith("()") ? "fun\xE7\xE3o" : "s\xEDmbolo";
}
var where = (n) => {
  const end = lineOf(n.end_location);
  const start2 = lineOf(n.source_location);
  return `${n.source_file}:${n.source_location || "L1"}${end > start2 ? `-L${end}` : ""}`;
};
var FENCE = { ts: "ts", tsx: "tsx", js: "js", mjs: "js", cjs: "js", jsx: "jsx", py: "python", go: "go", rs: "rust", java: "java", rb: "ruby", php: "php", cs: "csharp", kt: "kotlin", swift: "swift", md: "md" };
function snippet(n, src, max) {
  const start2 = lineOf(n.source_location);
  const end = Math.max(start2, lineOf(n.end_location));
  if (!start2 || isFileNode2(n)) return null;
  const lines = src.lines(n.source_file);
  if (!lines) return null;
  const last = Math.min(end, start2 + max - 1, lines.length);
  const width = String(last).length;
  const body2 = lines.slice(start2 - 1, last).map((l, i2) => `${String(start2 + i2).padStart(width)}  ${l}`);
  const lang = FENCE[path15.extname(n.source_file).slice(1)] ?? "";
  const more = end > last ? `
\u2026 mais ${end - last} linhas (${n.source_file}:L${last + 1}-L${end})` : "";
  return `\`\`\`${lang}
${body2.join("\n")}
\`\`\`${more}`;
}
function relatedLine(title, links, pick, byId, max = 5) {
  const seen = /* @__PURE__ */ new Set();
  const items = [];
  for (const l of links) {
    const other = byId.get(pick(l));
    if (!other || seen.has(other.id)) continue;
    seen.add(other.id);
    items.push(other.source_file ? `${other.label} (${other.source_file}:${l.source_location || other.source_location})` : other.label);
  }
  if (!items.length) return null;
  const extra = items.length > max ? ` \u2026 e mais ${items.length - max}` : "";
  return `   ${title}: ${items.slice(0, max).join(", ")}${extra}`;
}
function search(json, question, opts) {
  const src = new SourceCache(opts.root);
  const ranked = rankNodes(json, question, src);
  if (!ranked.length) return `Nada no grafo para "${question}". Tente com o nome de uma fun\xE7\xE3o, arquivo ou tela, ou rode faundr graph se o grafo estiver velho.`;
  const top = ranked[0].score;
  const limit = opts.limit ?? 8;
  const results = [];
  const labels = /* @__PURE__ */ new Set();
  for (const h of ranked) {
    if (results.length >= limit || results.length >= 3 && h.score < top * 0.15) break;
    const key = `${h.node.source_file}|${h.node.label}`;
    if (labels.has(key)) continue;
    labels.add(key);
    results.push(h);
  }
  const { byId, incoming, outgoing } = neighbors(json);
  const maxChars = (opts.budget ?? 3e3) * 4;
  const codeLines = opts.codeLines ?? 80;
  let used = 0;
  const blocks = results.map((h, i2) => {
    const n = h.node;
    const lines = [`${i2 + 1}. ${n.label}  ${where(n)}  [${KIND_LABEL(n)}]`];
    if (n.signature && n.signature !== n.label) lines.push(`   ${n.signature}`);
    const callers2 = relatedLine("Chamado por", (incoming.get(n.id) ?? []).filter((l) => CALLS.has(l.relation)), (l) => l.source, byId);
    const calls = relatedLine("Chama", (outgoing.get(n.id) ?? []).filter((l) => CALLS.has(l.relation)), (l) => l.target, byId);
    const importers = isFileNode2(n) ? relatedLine("Importado por", (incoming.get(n.id) ?? []).filter((l) => l.relation === "imports_from"), (l) => l.source, byId) : null;
    for (const l of [callers2, calls, importers]) if (l) lines.push(l);
    let text = lines.join("\n");
    const code = used + text.length < maxChars ? snippet(n, src, codeLines) : null;
    if (code && used + text.length + code.length <= maxChars) text += `
${code}`;
    else if (code) {
      const room = Math.floor((maxChars - used - text.length) / 60);
      const short = room >= 5 ? snippet(n, src, Math.min(room, codeLines)) : null;
      if (short) text += `
${short}`;
    }
    used += text.length;
    return text;
  });
  const header = `Busca no grafo: "${question}" \xB7 ${results.length} resultado(s) de ${ranked.length} que combinam (${json.nodes.length} n\xF3s)`;
  return [header, ...blocks].join("\n\n");
}

// engine/src/tools.ts
var WALK = /* @__PURE__ */ new Set(["calls", "indirect_call", "imports", "imports_from", "re_exports", "references", "inherits", "implements"]);
var RELATION_PT = {
  calls: "chama",
  indirect_call: "chama (indireto)",
  imports: "importa",
  imports_from: "importa",
  re_exports: "reexporta",
  references: "usa",
  inherits: "herda",
  implements: "implementa"
};
var bare = (label) => label.replace(/\(\)$/, "").replace(/^\./, "").toLowerCase();
function resolveNode(json, text) {
  const [scope, name2] = text.includes("::") ? text.split("::", 2) : [void 0, text];
  const q = name2.trim().toLowerCase();
  const nodes = json.nodes.filter((n) => n.source_file && (!scope || n.source_file.endsWith(scope)));
  const tiers = [
    (n) => isFileNode2(n) && (n.source_file.toLowerCase() === q || n.source_file.toLowerCase().endsWith(`/${q}`)),
    (n) => bare(n.label) === q.replace(/\(\)$/, "").replace(/^\./, ""),
    (n) => n.id === q,
    (n) => bare(n.label).startsWith(q)
  ];
  for (const tier of tiers) {
    const hits = nodes.filter(tier);
    if (!hits.length) continue;
    const deg = /* @__PURE__ */ new Map();
    for (const l of json.links) if (WALK.has(l.relation)) deg.set(l.target, (deg.get(l.target) ?? 0) + 1);
    hits.sort((a, b) => Number(b.file_type === "code") - Number(a.file_type === "code") || (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0));
    if (new Set(hits.map((h) => h.source_file)).size > 1) return { node: hits[0], ambiguous: hits };
    return { node: hits[0] };
  }
  return {};
}
function ambiguityNote(text, found) {
  if (!found.ambiguous) return "";
  const others = found.ambiguous.slice(1, 6).map((n) => `${n.source_file}::${bare(n.label)}`);
  return `
(H\xE1 ${found.ambiguous.length} com esse nome; usei ${where(found.node)}. Outros: ${others.join(", ")}. Para escolher: arquivo::${text}.)`;
}
function callers(json, text, opts = {}) {
  const direction = opts.direction ?? "in";
  const depth = Math.max(1, Math.min(opts.depth ?? 1, 5));
  const limit = opts.limit ?? 60;
  const found = resolveNode(json, text);
  if (!found.node) return `Nada no grafo com o nome '${text}'. Tente faundr graph-query "${text}".`;
  if (direction === "both") {
    const sides = ["in", "out"].map((d) => walkFrom(json, found.node, d, depth, limit));
    return sides.join("\n\n") + ambiguityNote(text, found);
  }
  return walkFrom(json, found.node, direction, depth, limit) + ambiguityNote(text, found);
}
function walkFrom(json, seed, direction, depth, limit) {
  const byId = new Map(json.nodes.map((n) => [n.id, n]));
  const adj = adjacency(json, direction);
  const seeds = isFileNode2(seed) ? [seed, ...json.nodes.filter((n) => n.source_file === seed.source_file && n.id !== seed.id)] : [seed];
  const visited = new Set(seeds.map((s) => s.id));
  const levels = [];
  let frontier = [...visited];
  let total = 0;
  for (let d = 1; d <= depth && frontier.length; d++) {
    const next = [];
    const lines = [];
    for (const cur of frontier) {
      for (const step of adj.get(cur) ?? []) {
        if (visited.has(step.other)) continue;
        visited.add(step.other);
        next.push(step.other);
        total++;
        if (total <= limit) lines.push(stepLine(byId, step, cur, d));
      }
    }
    if (lines.length) levels.push([levelTitle(d, direction), ...lines]);
    frontier = next;
  }
  const what = direction === "in" ? "Quem depende de" : "O que usa";
  const head = `${what} ${seed.label} (${where(seed)})${depth > 1 ? `, at\xE9 ${depth} saltos` : ""}: ${total} encontrado(s)`;
  if (!total) {
    const none = direction === "in" ? "Ningu\xE9m no projeto chama ou importa isso (pode ser ponto de entrada, rota ou c\xF3digo sem uso)." : "N\xE3o usa nada do projeto.";
    return `${head}
${none}`;
  }
  const cut = total > limit ? `
\u2026 e mais ${total - limit} (use --limit ${total})` : "";
  return [head, ...levels.map((l) => l.join("\n"))].join("\n") + cut;
}
function adjacency(json, direction) {
  const adj = /* @__PURE__ */ new Map();
  for (const l of json.links) {
    if (!WALK.has(l.relation)) continue;
    const key = direction === "in" ? l.target : l.source;
    const other = direction === "in" ? l.source : l.target;
    (adj.get(key) ?? adj.set(key, []).get(key)).push({ other, relation: l.relation, at: `${l.source_file}:${l.source_location}` });
  }
  return adj;
}
function levelTitle(d, direction) {
  if (d > 1) return `A ${d} saltos:`;
  return direction === "in" ? "Diretamente:" : "Usa diretamente:";
}
function stepLine(byId, { other, relation, at }, cur, d) {
  const n = byId.get(other);
  const label = n?.label ?? other;
  let loc = "(externo)";
  if (n?.source_file) loc = d === 1 ? at : where(n);
  return `  ${label}  ${loc}  [${RELATION_PT[relation] ?? relation}${d > 1 ? `, via ${byId.get(cur)?.label ?? cur}` : ""}]`;
}
function skeleton(json, file) {
  const q = file.replace(/\\/g, "/").toLowerCase();
  const files = json.nodes.filter((n) => isFileNode2(n) && (n.source_file.toLowerCase() === q || n.source_file.toLowerCase().endsWith(`/${q}`)));
  if (!files.length) {
    const near = json.nodes.filter((n) => isFileNode2(n) && n.source_file.toLowerCase().includes(q)).slice(0, 5);
    return `Arquivo '${file}' n\xE3o est\xE1 no grafo.${near.length ? ` Parecidos: ${near.map((n) => n.source_file).join(", ")}` : ""}`;
  }
  if (files.length > 1) return `V\xE1rios arquivos com esse nome: ${files.map((n) => n.source_file).join(", ")}. Passe o caminho completo.`;
  const rel = files[0].source_file;
  const { byId, outgoing, incoming } = neighbors(json);
  const symbols = json.nodes.filter((n) => n.source_file === rel && !isFileNode2(n) && n.file_type !== "rationale").sort((a, b) => lineOf(a.source_location) - lineOf(b.source_location));
  const lines = symbols.map((n) => {
    const indent = n.label.startsWith(".") ? "    " : "  ";
    const end = lineOf(n.end_location);
    const span2 = end > lineOf(n.source_location) ? `${n.source_location}-L${end}` : n.source_location;
    const used = (incoming.get(n.id) ?? []).filter((l) => WALK.has(l.relation)).length;
    return `${indent}${span2.padEnd(11)} ${n.signature ?? n.label}${used ? `  \xB7 usado ${used}x` : ""}`;
  });
  const imports = [...new Set((outgoing.get(files[0].id) ?? []).filter((l) => l.relation === "imports_from").map((l) => byId.get(l.target)?.source_file || byId.get(l.target)?.label || l.target))];
  const importers = (incoming.get(files[0].id) ?? []).filter((l) => l.relation === "imports_from").length;
  return [
    `Esqueleto de ${rel}: ${symbols.length} defini\xE7\xE3o(\xF5es); importado por ${importers} arquivo(s)`,
    ...imports.length ? [`Importa: ${imports.join(", ")}`] : [],
    "",
    ...lines
  ].join("\n");
}
function grep(json, pattern, opts) {
  let re;
  try {
    re = new RegExp(pattern, opts.ignoreCase ? "i" : "");
  } catch {
    re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), opts.ignoreCase ? "i" : "");
  }
  const maxHits = opts.maxHits ?? 200;
  const maxGroups = opts.maxGroups ?? 30;
  const prefix = opts.in?.replace(/\\/g, "/").replace(/^\.\//, "");
  const src = new SourceCache(opts.root);
  const { incoming } = neighbors(json);
  const inDegree = (id) => (incoming.get(id) ?? []).filter((l) => WALK.has(l.relation)).length;
  const files = json.nodes.filter((n) => isFileNode2(n) && (!prefix || n.source_file.startsWith(prefix)));
  const bySymbolFile = /* @__PURE__ */ new Map();
  for (const n of json.nodes) if (n.source_file && !isFileNode2(n) && n.end_location) (bySymbolFile.get(n.source_file) ?? bySymbolFile.set(n.source_file, []).get(n.source_file)).push(n);
  const groups = /* @__PURE__ */ new Map();
  let total = 0;
  for (const f of files) {
    const lines = src.lines(f.source_file);
    if (!lines) continue;
    const symbols = bySymbolFile.get(f.source_file) ?? [];
    lines.forEach((text, i2) => {
      if (!re.test(text)) return;
      total++;
      if (total > maxHits) return;
      const ln = i2 + 1;
      let best = null;
      for (const s of symbols) {
        const a = lineOf(s.source_location);
        const b = lineOf(s.end_location);
        if (a <= ln && ln <= b && (!best || b - a < lineOf(best.end_location) - lineOf(best.source_location))) best = s;
      }
      const key = best?.id ?? `file:${f.source_file}`;
      const g = groups.get(key) ?? { symbol: best, file: f.source_file, inDegree: best ? inDegree(best.id) : 0, hits: [] };
      g.hits.push(`    L${ln}: ${text.trim().slice(0, 160)}`);
      groups.set(key, g);
    });
  }
  if (!total) return `Nada encontrado para /${pattern}/ em ${files.length} arquivo(s) do grafo.`;
  const sorted = [...groups.values()].sort((a, b) => b.inDegree - a.inDegree || a.file.localeCompare(b.file));
  const shown = sorted.slice(0, maxGroups).map((g) => {
    const title = g.symbol ? `${g.symbol.label}  ${where(g.symbol)}${g.inDegree ? `  \xB7 usado ${g.inDegree}x` : ""}` : `${g.file} (fora de fun\xE7\xF5es)`;
    return [`  ${title}`, ...g.hits.slice(0, 8), ...g.hits.length > 8 ? [`    \u2026 e mais ${g.hits.length - 8} nesta defini\xE7\xE3o`] : []].join("\n");
  });
  const cut = [
    total > maxHits ? `${total - maxHits} ocorr\xEAncia(s) al\xE9m do limite de ${maxHits}` : "",
    sorted.length > maxGroups ? `${sorted.length - maxGroups} grupo(s) n\xE3o mostrados` : ""
  ].filter(Boolean);
  return [
    `Busca /${pattern}/: ${total} ocorr\xEAncia(s) em ${groups.size} lugar(es) de ${files.length} arquivo(s); os mais usados primeiro`,
    ...shown,
    ...cut.length ? [`(${cut.join("; ")}; refine com --in <pasta>)`] : []
  ].join("\n");
}

// engine/src/cli.ts
function flag(args2, name2) {
  const i2 = args2.indexOf(name2);
  return i2 >= 0 ? args2[i2 + 1] : void 0;
}
function directionFlag(args2) {
  if (args2.includes("--both")) return "both";
  return args2.includes("--out") ? "out" : "in";
}
async function runEngine(args2, root = process.cwd()) {
  const [cmd, ...rest] = args2;
  const positional = rest.filter((a, i2) => !a.startsWith("--") && a !== "-i" && !(i2 > 0 && ["--budget", "--limit", "--depth", "--in"].includes(rest[i2 - 1])));
  switch (cmd) {
    case "build": {
      const dir2 = path16.resolve(positional[0] ?? root);
      const result = await buildProjectGraph(dir2);
      writeOutputs(dir2, result);
      const s = result.stats;
      return `Grafo gerado: ${s.nodes} n\xF3s, ${s.edges} liga\xE7\xF5es, ${s.communities} comunidades a partir de ${s.files} arquivos (${(s.ms / 1e3).toFixed(1)} s).`;
    }
    case "query":
      if (rest.includes("--subgraph")) return query(loadGraphJson(root), positional.join(" "), { budget: Number(flag(rest, "--budget") ?? 2e3), dfs: rest.includes("--dfs") });
      return search(loadGraphJson(root), positional.join(" "), {
        root,
        budget: Number(flag(rest, "--budget") ?? 3e3),
        limit: Number(flag(rest, "--limit") ?? 8)
      });
    case "path":
      if (positional.length < 2) throw new Error('uso: path "A" "B" [--undirected]');
      return shortestPath(loadGraphJson(root), positional[0], positional[1], { undirected: rest.includes("--undirected") });
    case "callers": {
      const depth = Number(flag(rest, "--depth") ?? 1);
      const direction = directionFlag(rest);
      return callers(loadGraphJson(root), positional.join(" "), { direction, depth, limit: Number(flag(rest, "--limit") ?? 60) });
    }
    case "skeleton":
      return skeleton(loadGraphJson(root), positional.join(" "));
    case "grep":
      return grep(loadGraphJson(root), positional.join(" "), { root, in: flag(rest, "--in"), ignoreCase: rest.includes("-i") || rest.includes("--ignore-case") });
    // explain virou callers --both: quem usa e o que usa, com arquivo e linha.
    case "explain":
      return callers(loadGraphJson(root), positional.join(" "), { direction: "both", limit: Number(flag(rest, "--limit") ?? 60) });
    default:
      return 'comandos: build [raiz] | query "<pergunta>" [--budget N] [--limit N] [--subgraph [--dfs]] | callers X [--out | --both] [--depth N] | skeleton <arquivo> | grep <padr\xE3o> [--in pasta] [-i] | path "A" "B" [--undirected]';
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
  callers,
  grep,
  loadGraphJson,
  qualityGrammar,
  query,
  rankNodes,
  refreshGraph,
  runEngine,
  search,
  shortestPath,
  skeleton,
  unusedCode,
  wordsOf,
  writeOutputs
};
