YUI.add('gallery-flyweight-tree', function (Y, NAME) {

'use strict';
/*jslint white: true */
var Lang = Y.Lang,
	YArray = Y.Array,

    DOT = '.',
	BYPASS_PROXY = "_bypassProxy",
	CBX = 'contentBox',
	VALUE = 'value',
    EXPANDED = 'expanded',
    DYNAMIC_LOADER = 'dynamicLoader',
    TABINDEX = 'tabIndex',
    FOCUSED = 'focused',

    DEFAULT_POOL = '_default',

    getCName = Y.ClassNameManager.getClassName,
    FWNODE_NAME = 'flyweight-tree-node',
	CNAME_NODE = getCName(FWNODE_NAME),
	cName = function (name) {
		return getCName(FWNODE_NAME, name);
	},
    CNAME_CONTENT = cName('content'),
	CNAME_CHILDREN = cName('children'),
	CNAME_COLLAPSED = cName('collapsed'),
	CNAME_EXPANDED = cName(EXPANDED),
	CNAME_NOCHILDREN = cName('no-children'),
	CNAME_FIRSTCHILD = cName('first-child'),
	CNAME_LASTCHILD = cName('last-child'),
	CNAME_LOADING = cName('loading'),

	FWMgr,
	FWNode;

/**
* @module gallery-flyweight-tree
*
*/

/**
 * Widget to handle its child nodes by using the flyweight pattern.
 *
 * The information for the tree is stored internally in a plain object without methods,
 * events or attributes.
 * This manager will position FlyweightTreeNode instances (or subclasses of it)
 * over these iNodes from a small pool of them, in order to save memory.
 *
 * The nodes on this configuration tree are referred to in this documentation as `iNodes`
 * for 'internal nodes', to tell them apart from the pooled FlyweightTreeNode instances
 * that will be used to manipulate them.  The FlyweightTreeNode instances will usually
 * be declared as `fwNodes` when confusion might arise.
 * If a variable or argument is not explicitly named `iNode` or a related name it is
 * FlyweightTreeNode instance.
 *
 * The developer should not be concerned about the iNodes,
 * except in the initial configuration tree.
 * If the developer finds anything that needs to be done through iNodes,
 * it is a bug and should be reported (thanks).
 * iNodes should be private.
 *
 * @class FlyweightTreeManager
 * @extends Widget
 * @constructor
 */

FWMgr = Y.Base.create(
    NAME,
    Y.Widget,
    [],
    {
        /**
         * Clone of the configuration tree.
         * The FlyweightTreeNode instances will use the iNodes (internal nodes) in this tree as the storage for their state.
         * @property _tree
         * @type Object
         * @private
         */
        _tree: null,
        /**
         * Pool of FlyweightTreeNode instances to use and reuse by the manager.
         * It contains a hash of arrays indexed by the iNode (internal node) type.
         * Each array contains a series of FlyweightTreeNode subclasses of the corresponding type.
         * @property _pool
         * @type {Object}
         * @private
         */
        _pool: null,
        /**
         * List of dom events to be listened for at the outer container and fired again
         * at the FlyweightTreeNode level once positioned over the source iNode.
         *
         * Since the node instances are not actually there, they can't listen to the events themselves
         * so the events listed here will serve to wake up those instances and get the event
         * as if they had been there all along.
         * @property _domEvents
         * @type Array of strings
         * @protected
         * @default null
         */
        _domEvents: null,
        /**
         * Reference to the element that has the focus or should have the focus
         * when this widget is active (ie, tabbed into).
         * Mostly used for WAI-ARIA support.
         * @property _focusedINode
         * @type FlyweightTreeNode
         * @private
         * @default null
         */
        _focusedINode: null,

        /**
         * Event handles of events subscribed to, to detach them on destroy
         * @property _eventHandles
         * @type Array of EventHandles
         * @private
         */
        _eventHandles: null,

        /**
         * Part of the Widget lifecycle.
         * @method initializer
         * @protected
         */
        initializer:function () {
            this._pool = {};
            this._eventHandles = [];
        },
        /**
         * Part of the lifecycle.  Destroys the pools.
         * @method destructor
         * @protected
         */
        destructor: function () {
            YArray.each(this._pool, function (fwNode) {
                fwNode.destroy();
            });
            this._pool = null;
            YArray.each(this._eventHandles, function (evHandle) {
                evHandle.detach();
            });
            this._eventHandles = null;

        },
        /**
         * Method to load the configuration tree.
         * The nodes in this tree are copied into iNodes (internal nodes) for internal use.
         *
         * The initializer does not load the tree automatically so as to allow the subclass
         * of this manager
         * to process the tree definition anyway it wants, adding defaults and such
         * and to name the tree whatever is suitable.
         * For TreeView, the configuration property is named `tree`, for a form, it is named `form`.
         * It also sets initial values for some default properties such as `parent` references and `id` for all iNodes.
         * @method _loadConfig
         * @param tree {Array} Configuration for the first level of nodes.
         * Contains objects with the following attributes:
         * @param tree.label {String} Text or HTML markup to be shown in the node
         * @param [tree.expanded=true] {Boolean} Whether the children of this node should be visible.
         * @param [tree.children] {Array} Further definitions for the children of this node
         * @param [tree.type=FWTreeNode] {FWTreeNode | String} Class used to create instances for this iNode.
         * It can be a reference to an object or a name that can be resolved as `Y[name]`.
         * @param [tree.id=Y.guid()] {String} Identifier to assign to the DOM element containing the UI for this node.
         * @param [tree.template] {String} Template for this particular node.
         * @protected
         */
        _loadConfig: function (tree) {
            this._tree = {
                children: Y.clone(tree)
            };
            this._initNodes(this._tree);

        },
        /** Initializes the iNodes configuration with default values and management info.
         * @method _initNodes
         * @param parentINode {Object} Parent of the iNodes to be set
         * @private
         */
        _initNodes: function (parentINode) {
            var self = this,
                dynLoad = !!self.get(DYNAMIC_LOADER);
            YArray.each(parentINode.children, function (iNode) {
                if (!self._focusedINode) {
                    self._focusedINode = iNode;
                }
                iNode._parent = parentINode;
                iNode.id = iNode.id || Y.guid();
                if (dynLoad && !iNode.children) {
                    iNode.expanded = !!iNode.isLeaf;
                } else {
                    iNode.expanded = (iNode.expanded === undefined) || !!iNode.expanded;
                }
                self._initNodes(iNode);
            });
        },
		/**
		 * Widget lifecyle method.
         *
         * Gets the HTML markup for the visible nodes and inserts it into the contentbox.
		 * @method renderUI
		 * @protected
		 */
		renderUI: function () {
            this.get(CBX).setHTML(this._getHTML());
        },
        /**
         * Initializes the events for its internal use and those requested in
         * the {{#crossLink "_domEvents"}}{{/crossLink}} array.
         * @method bindUI
         * @protected
         */
        bindUI: function() {
            var self = this;

            self._eventHandles.push(self.after('focus', self._afterFocus));
            if (self._domEvents) {
                YArray.each(self._domEvents, function (event) {
                    self._eventHandles.push(self.after(event, self._afterDomEvent, self));
                });
            }
        },
        /**
         * Overrides the native `fire` method so that for DOM events,
         * it will fetch from the pool the fwNode that should have received
         * the event and add it to the event facade as property `node`.
         *
         * @method fire
         * @param type {String|Object} The type of the event, or an object that contains
         * a 'type' property.
         * @param arguments {Object*} an arbitrary set of parameters to pass to
         * the handler. If the first of these is an object literal and the event is
         * configured to emit an event facade, the event facade will replace that
         * parameter after the properties the object literal contains are copied to
         * the event facade.
         * @return {Boolean} false if the event was halted.
         */
        fire: function (type, ev) {
            var ret, self = this;
            if (ev && ev.domEvent) {
                ev.node = self._poolFetchFromEvent(ev);
                ret = FWMgr.superclass.fire.call(self, type, ev);
                self._poolReturn(ev.node);
                return ret;
            }
            return FWMgr.superclass.fire.apply(self, arguments);
        },
        /**
         * Expands all the nodes of the tree.
         *
         * It will only expand existing nodes.  If there is a {{#crossLink "dynamicLoader:attribute"}}{{/crossLink}} configured
         * it will not expand those since that might lead to extreme situations.
         * @method expandAll
         * @chainable
         */
        expandAll: function () {
            this._forSomeINode(function(iNode) {
                if (iNode.children && !iNode.expanded) {
                    this._poolReturn(this._poolFetch(iNode).set(EXPANDED, true));
                }
            });
        },

        /** Generic event listener for DOM events listed in the {{#crossLink "_domEvents"}}{{/crossLink}} array.
         *  It will locate the iNode represented by the UI elements that received the event,
         *  slide a suitable instance on it and fire the same event on that node.
         *  @method _afterEvent
         *  @param ev {EventFacade} Event facade as produced by the event
         *  @private
         */
        _afterDomEvent: function(ev) {
            var fwNode =  ev.node;
            if (fwNode) {
                fwNode.fire(ev.type.split(':')[1], {domEvent:ev.domEvent});
            }
        },
        /**
         * Returns a string identifying the type of the object to handle the iNode
         * or null if type was not a FlyweightNode instance.
         * @method _getTypeString
         * @param iNode {Object} Internal node in the tree configuration
         * @return {String} type of iNode.
         * @private
         */
        _getTypeString: function (iNode) {
            var type = iNode.type || DEFAULT_POOL;
            if (!Lang.isString(type)) {
                if (Lang.isObject(type)) {
                    type = type.NAME;
                } else {
                    throw "Node contains unknown type";
                }
            }
            return type;
        },
        /**
         * Pulls from the pool an instance of the type declared in the given iNode
         * and slides it over that iNode.
         * If there are no instances of the given type in the pool, a new one will be created via {{#crossLink "_createNode"}}{{/crossLink}}
         * If an instance is held (see: {{#crossLink "FlyweightTreeNode/hold"}}{{/crossLink}}), it will be returned instead.
         * @method _poolFetch
         * @param iNode {Object} reference to a iNode within the configuration tree
         * @return {FlyweightTreeNode} Usually a subclass of FlyweightTreeNode positioned over the given iNode
         * @protected
         */
        _poolFetch: function(iNode) {
            var pool,
                fwNode = iNode._held,
                type = this._getTypeString(iNode);

            if (fwNode) {
                return fwNode;
            }
            pool = this._pool[type];
            if (pool === undefined) {
                pool = this._pool[type] = [];
            }
            if (pool.length) {
                fwNode = pool.pop();
                fwNode._slideTo(iNode);
                return fwNode;
            }
            return this._createNode(iNode);
        },
        /**
         * Returns the FlyweightTreeNode instance to the pool.
         * Instances held (see: {{#crossLink "FlyweightTreeNode/hold"}}{{/crossLink}}) are never returned.
         * @method _poolReturn
         * @param fwNode {FlyweightTreeNode} Instance to return.
         * @protected
         */
        _poolReturn: function (fwNode) {
            if (fwNode._iNode._held) {
                return;
            }
            var pool,
                type = this._getTypeString(fwNode._iNode);
            pool = this._pool[type];
            if (pool) {
                pool.push(fwNode);
            }

        },
        /**
         * Returns a new instance of the type given in iNode or the
         * {{#crossLink "defaultType"}}{{/crossLink}} if none specified
         * and slides it on top of the iNode provided.
         * @method _createNode
         * @param iNode {Object} reference to a iNode within the configuration tree
         * @return {FlyweightTreeNode} Instance of the corresponding subclass of FlyweightTreeNode
         * @protected
         */
        _createNode: function (iNode) {
            var newNode,
                Type = iNode.type || this.get('defaultType');
            if (Lang.isString(Type)) {
                Type = Y[Type];
            }
            if (Type) {
                newNode = new Type({root:this});
                if (newNode instanceof Y.FlyweightTreeNode) {
                    // I need to do this otherwise Attribute will initialize
                    // the real iNode with default values when activating a lazyAdd attribute.
                    newNode._slideTo({});
                    YArray.each(Y.Object.keys(newNode._state.data), newNode._addLazyAttr, newNode);
                    // newNode.getAttrs();
                    // That's it (see above)
                    newNode._root =  this;
                    newNode._slideTo(iNode);
                    return newNode;
                }
            }
            return null;
        },
        /**
         * Returns an instance of Flyweight node positioned over the root
         * @method getRoot
         * @return {FlyweightTreeNode}
         */
        getRoot: function () {
            return this._poolFetch(this._tree);
        },
        /**
         * Returns a string with the markup for the whole tree.
         * A subclass might opt to produce markup for those parts visible. (lazy rendering)
         * @method _getHTML
         * @return {String} HTML for this widget
         * @protected
         */
        _getHTML: function () {
            var s = '',
                root = this.getRoot();
            root.forSomeChildren( function (fwNode, index, array) {
                s += fwNode._getHTML(index, array.length, 0);
            });
            this._poolReturn(root);
            return s;
        },
        /**
         * Locates a iNode in the tree by the element that represents it.
         * @method _findINodeByElement
         * @param el {Node} Any element belonging to the tree
         * @return {Object} iNode that produced the markup for that element or null if not found
         * @protected
         */
        _findINodeByElement: function(el) {
            var id = el.ancestor(DOT + FWNode.CNAME_NODE, true).get('id'),
                found = null,
                scan = function (iNode) {
                    if (iNode.id === id) {
                        found = iNode;
                        return true;
                    }
                    if (iNode.children) {
                        return YArray.some(iNode.children, scan);
                    }
                    return false;
                };
            if (scan(this._tree)) {
                return found;
            }
            return null;
        },
        /**
         * Returns a FlyweightTreeNode instance from the pool, positioned over the iNode whose markup generated some event.
         * @method _poolFetchFromEvent
         * @param ev {EventFacade}
         * @return {FlyweightTreeNode} The FlyweightTreeNode instance or null if not found.
         * @private
         */
        _poolFetchFromEvent: function (ev) {
            var found = this._findINodeByElement(ev.domEvent.target);
            if (found) {
                return this._poolFetch(found);
            }
            return null;
        },
        /**
         * Traverses the whole configuration tree, calling a given function for each iNode.
         * If the function returns true, the traversing will terminate.
         * @method _forSomeINode
         * @param fn {Function} Function to call on each configuration iNode
         *		@param fn.iNode {Object} iNode in the configuration tree
         *		@param fn.depth {Integer} depth of this iNode within the tree
         *		@param fn.index {Integer} index of this iNode within the array of its siblings
         * @param scope {Object} scope to run the function in, defaults to `this`.
         * @return true if any of the function calls returned true (the traversal was terminated earlier)
         * @protected
         */
        _forSomeINode: function(fn, scope) {
            scope = scope || this;
            var loop = function(iNode, depth) {
                return YArray.some(iNode.children || [], function(childINode, index) {
                    if (fn.call(scope, childINode,depth, index)) {
                        return true;
                    }
                    return loop(childINode,depth + 1);
                });
            };
            return loop(this._tree, 0);
        },
        /**
         * Executes the given function over all the nodes in the tree or until the function returns true.
         * If dynamic loading is enabled, it will not run over nodes not yet loaded.
         * @method forSomeNodes
         * @param fn {function} function to execute on each node.  It will receive:
         *	@param fn.node {FlyweightTreeNode} node being visited.
         *	@param fn.depth {Integer} depth from the root. The root node is level zero and it is not traversed.
         *	@param fn.index {Integer} position of this node within its branch
         *	@param fn.array {Array} array containing itself and its siblings
         * @param scope {Object} Scope to run the function in.  Defaults to the FlyweightTreeManager instance.
         * @return {Boolean} true if any function calls returned true (the traversal was interrupted)
         */
        forSomeNodes: function (fn, scope) {
            scope = scope || this;

            var forOneLevel = function (fwNode, depth) {
                fwNode.forSomeChildren(function (fwNode, index, array) {
                    if (fn.call(scope, fwNode, depth, index, array) === true) {
                        return true;
                    }
                    return forOneLevel(fwNode, depth+1);
                });
            };
            return forOneLevel(this.getRoot(), 1);
        },
        /**
         * Getter for the {{#crossLink "focusedNode:attribute"}}{{/crossLink}} attribute
         * @method _focusedNodeGetter
         * @return {FlyweightNode} Node that would have the focus if the widget is focused
         * @private
         */
        _focusedNodeGetter: function () {
            return this._poolFetch(this._focusedINode);
        },
        /**
         * Setter for the {{#crossLink "focusedNode:attribute"}}{{/crossLink}} attribute
         * @method _focusedNodeSetter
         * @param value {FlyweightNode} Node to receive the focus.
         * @return {Object} iNode matching the focused node.
         * @private
         */
        _focusedNodeSetter: function (value) {
            if (!value || value instanceof Y.FlyweightTreeNode) {
                var newINode = (value?value._iNode:this._tree.children[0]);
                this._focusOnINode(newINode);
                return newINode;
            } else {
                return Y.Attribute.INVALID_VALUE;
            }
        },
        /**
         * Sets the focus on the given iNode
         * @method _focusOnINode
         * @param iNode {Object} iNode to receive the focus
         * @private
         */
        _focusOnINode: function (iNode) {
            var prevINode = this._focusedINode,
                el;

            if (iNode && iNode !== prevINode) {

                el = Y.one('#' + prevINode.id + ' .' + CNAME_CONTENT);
                el.blur();
                el.set(TABINDEX, -1);

                el = Y.one('#' + iNode.id + ' .' + CNAME_CONTENT);
                el.focus();
                el.set(TABINDEX,0);

                this._focusedINode = iNode;
            }

        },
        /**
         * Setter for the {{#crossLink "dynamicLoader:attribute"}}{{/crossLink}} attribute.
         * It changes the expanded attribute to false on childless iNodes not marked with `isLeaf
         * since they can now be expanded.
         * @method
         * @param value {Function | null } Function to handle the loading of nodes on demand
         * @return {Function | null | INVALID_VALUE} function set or rejection
         * @private
         */
        _dynamicLoaderSetter: function (value) {
            if (!Lang.isFunction(value) &&  value !== null) {
                return Y.Attribute.INVALID_VALUE;
            }
            if (value) {
                this._forSomeINode(function(iNode) {
                    if (!iNode.children) {
                        iNode.expanded = !!iNode.isLeaf;
                    }
                });
            }
            return value;
        }
    },
    {
        ATTRS: {
            /**
             * Default object type of the nodes if no explicit type is given in the configuration tree.
             * It can be specified as an object reference, these two are equivalent: `Y.FWTreeNode` or  `'FWTreeNode'`.
             *
             * @attribute defaultType
             * @type {String | Object}
             * @default 'FlyweightTreeNode'
             */
            defaultType: {
                value: 'FlyweightTreeNode'
            },
            /**
             * Function used to load the nodes dynamically.
             * Function will run in the scope of the FlyweightTreeManager instance and will
             * receive:
             *
             * * node {FlyweightTreeNode} reference to the parent of the children to be loaded.
             * * callback {Function} function to call with the configuration info for the children.
             *
             * The function shall fetch the nodes and create a configuration object
             * much like the one a whole tree might receive.
             * It is not limited to just one level of nodes, it might contain children elements as well.
             * When the data is processed, it should call the callback with the configuration object.
             * The function is responsible of handling any errors.
             * If the the callback is called with no arguments, the parent node will be marked as having no children.
             *
             * This attribute should be set before the tree is rendered as childless nodes
             * render differently when there is a dynamic loader than when there isn't.
             * (childless nodes can be expanded when a dynamic loader is present and the UI should reflect that).
             * @attribute dynamicLoader
             * @type {Function or null}
             * @default null
             */
            dynamicLoader: {
                value: null,
                setter: '_dynamicLoaderSetter'
            },
            /**
             * Points to the node that currently has the focus.
             * If read, please make sure to release the node instance to the pool when done.
             * @attribute focusedNode
             * @type FlyweightTreeNode
             * @default First node in the tree
             */
            focusedNode: {
                getter: '_focusedNodeGetter',
                setter: '_focusedNodeSetter'
                // There is no need for validator since the setter already takes care of validation.
            }

        }
    });


Y.FlyweightTreeManager = FWMgr;
/**
* An implementation of the flyweight pattern.
* This object can be slid on top of a literal object containing the definition
* of a tree and will take its state from that iNode it is slid upon.
* It relies for most of its functionality on the flyweight manager object,
* which contains most of the code.
* @module gallery-flyweight-tree
*/

/**
* An implementation of the flyweight pattern.  This class should not be instantiated directly.
* Instances of this class can be requested from the flyweight manager class
* @class FlyweightTreeNode
* @extends Base
* @constructor  Do not instantiate directly.
*/
FWNode = Y.Base.create(
	FWNODE_NAME,
	Y.Base,
	[],
	{
		/**
		 * Reference to the iNode in the configuration tree it has been slid over.
		 * @property _iNode
		 * @type {Object}
		 * @private
		 **/
		_iNode:null,
		/**
		 * Reference to the FlyweightTreeManager instance this node belongs to.
		 * It is set by the root and should be considered read-only.
		 * @property _root
		 * @type FlyweightTreeManager
		 * @private
		 */
		_root: null,
        /**
         *
         */
        initializer: function (cfg) {
            this._root = cfg.root;
        },
		/**
		 * Returns a string with the markup for this node along that of its children
		 * produced from its attributes rendered
		 * via the first template string it finds in these locations:
		 *
		 * * It's own {{#crossLink "template"}}{{/crossLink}} configuration attribute
		 * * The static {{#crossLink "FlyweightTreeNode/TEMPLATE"}}{{/crossLink}} class property
		 *
		 * @method _getHTML
		 * @param index {Integer} index of this node within the array of siblings
		 * @param nSiblings {Integer} number of siblings including this node
		 * @param depth {Integer} number of levels to the root
		 * @return {String} markup generated by this node
		 * @protected
		 */
		_getHTML: function(index, nSiblings, depth) {
			// assumes that if you asked for the HTML it is because you are rendering it
			var root = this._root,
                iNode = this._iNode,
				attrs = this.getAttrs(),
				s = '',
				templ = iNode.template,
				childCount = iNode.children && iNode.children.length,
				nodeClasses = [CNAME_NODE],
				superConstructor = this.constructor;

			while (!templ) {
				templ = superConstructor.TEMPLATE;
				superConstructor = superConstructor.superclass.constructor;

			}

			iNode._rendered = true;
			if (childCount) {
				if (attrs.expanded) {
					iNode._childrenRendered = true;
					this.forSomeChildren( function (fwNode, index, array) {
						s += fwNode._getHTML(index, array.length, depth + 1);
					});
					nodeClasses.push(CNAME_EXPANDED);
				} else {
					nodeClasses.push(CNAME_COLLAPSED);
				}
			} else {
				if (this._root.get(DYNAMIC_LOADER) && !iNode.isLeaf) {
					nodeClasses.push(CNAME_COLLAPSED);
				} else {
					nodeClasses.push(CNAME_NOCHILDREN);
				}
			}
			if (index === 0) {
				nodeClasses.push(CNAME_FIRSTCHILD);
			}
			if (index === nSiblings - 1) {
				nodeClasses.push(CNAME_LASTCHILD);
			}
			attrs.children = s;
			attrs.cname_node = nodeClasses.join(' ');
			attrs.cname_content = CNAME_CONTENT;
			attrs.cname_children = CNAME_CHILDREN;
            attrs.tabIndex = (iNode === root._focusedINode)?0:-1;

			return Lang.sub(templ, attrs);

		},
		/**
		 * Method to slide this instance on top of another iNode in the configuration object
		 * @method _slideTo
		 * @param iNode {Object} iNode in the underlying configuration tree to slide this object on top of.
		 * @private
		 */
		_slideTo: function (iNode) {
			this._iNode = iNode;
			this._stateProxy = iNode;
		},
		/**
		 * Executes the given function on each of the child nodes of this node.
		 * @method forSomeChildren
		 * @param fn {Function} Function to be executed on each node
		 *		@param fn.child {FlyweightTreeNode} Instance of a suitable subclass of FlyweightTreeNode,
		 *		positioned on top of the child node
		 *		@param fn.index {Integer} Index of this child within the array of children
		 *		@param fn.array {Array} array containing itself and its siblings
		 * @param scope {object} The falue of this for the function.  Defaults to the parent.
		**/
		forSomeChildren: function(fn, scope) {
			var root = this._root,
				children = this._iNode.children,
				child, ret;
			scope = scope || this;
			if (children && children.length) {
				YArray.some(children, function (iNode, index, array) {
					child = root._poolFetch(iNode);
					ret = fn.call(scope, child, index, array);
					root._poolReturn(child);
					return ret;
				});
			}
		},
		/**
		 * Getter for the expanded configuration attribute.
		 * It is meant to be overriden by the developer.
		 * The supplied version defaults to true if the expanded property
		 * is not set in the underlying configuration tree.
		 * It can be overriden to default to false.
		 * @method _expandedGetter
		 * @return {Boolean} The expanded state of the node.
		 * @protected
		 */
		_expandedGetter: function () {
			return this._iNode.expanded !== false;
		},
		/**
		 * Setter for the expanded configuration attribute.
		 * It renders the child nodes if this branch has never been expanded.
		 * Then sets the className on the node to the static constants
		 * CNAME_COLLAPSED or CNAME_EXPANDED from Y.FlyweightTreeManager
		 * @method _expandedSetter
		 * @param value {Boolean} new value for the expanded attribute
		 * @private
		 */
		_expandedSetter: function (value) {
			var self = this,
				iNode = self._iNode,
				root = self._root,
				el = Y.one('#' + iNode.id),
				dynLoader = root.get(DYNAMIC_LOADER);

			iNode.expanded = value = !!value;
			if (dynLoader && !iNode.isLeaf && (!iNode.children  || !iNode.children.length)) {
				this._loadDynamic();
				return;
			}
			if (iNode.children && iNode.children.length) {
				if (value) {
					if (!iNode._childrenRendered) {
						self._renderChildren();
					}
					el.replaceClass(CNAME_COLLAPSED, CNAME_EXPANDED);
				} else {
					el.replaceClass(CNAME_EXPANDED, CNAME_COLLAPSED);
				}
			}
            el.set('aria-expanded', String(value));
		},
		/**
		 * Triggers the dynamic loading of children for this node.
		 * @method _loadDynamic
		 * @private
		 */
		_loadDynamic: function () {
			var self = this,
				root = self._root;
			Y.one('#' + this.get('id')).replaceClass(CNAME_COLLAPSED, CNAME_LOADING);
			root.get(DYNAMIC_LOADER).call(root, self, Y.bind(self._dynamicLoadReturn, self));

		},
		/**
		 * Callback for the dynamicLoader method.
		 * @method _dynamicLoadReturn
		 * @param response {Array} array of child iNodes
		 * @private
		 */
		_dynamicLoadReturn: function (response) {
			var self = this,
				iNode = self._iNode,
				root = self._root;

			if (response) {

				iNode.children = response;
				root._initNodes(iNode);
				self._renderChildren();
			} else {
				iNode.isLeaf = true;
			}
			// isLeaf might have been set in the response, not just in the line above.
			Y.one('#' + iNode.id).replaceClass(CNAME_LOADING, (iNode.isLeaf?CNAME_NOCHILDREN:CNAME_EXPANDED));
		},
		/**
		 * Renders the children of this node.
		 * It the children had been rendered, they will be replaced.
		 * @method _renderChildren
		 * @private
		 */
		_renderChildren: function () {
			var s = '',
				iNode = this._iNode,
				depth = this.get('depth');
			iNode._childrenRendered = true;
			this.forSomeChildren(function (fwNode, index, array) {
				s += fwNode._getHTML(index, array.length, depth + 1);
			});
			Y.one('#' + iNode.id + ' .' + CNAME_CHILDREN).setContent(s);
		},
		/**
		 * Prevents this instance from being returned to the pool and reused.
		 * Remember to {{#crossLink "release"}}{{/crossLink}} this instance when no longer needed.
		 * @method hold
		 * @chainable
		 */
		hold: function () {
			return (this._iNode._held = this);
		},
		/**
		 * Allows this instance to be returned to the pool and reused.
		 *
		 * __Important__: This instance should not be used after being released
		 * @method release
		 * @chainable
		 */
		release: function () {
			this._iNode._held = null;
			this._root._poolReturn(this);
			return this;
		},
		/**
		 * Returns the parent node for this node or null if none exists.
		 * The copy is not on {{#crossLink "hold"}}{{/crossLink}}.
		 * Remember to release the copy to the pool when done.
		 * @method getParent
		 * @return FlyweightTreeNode
		 */
		getParent: function() {
			var iNode = this._iNode._parent;
			return (iNode?this._root._poolFetch(iNode):null);
		},
		/**
		 * Returns the next sibling node for this node or null if none exists.
		 * The copy is not on {{#crossLink "hold"}}{{/crossLink}}.
		 * Remember to release the copy to the pool when done.
		 * @method getNextSibling
		 * @return FlyweightTreeNode
		 */
		getNextSibling: function() {
			var parent = this._iNode._parent,
				siblings = (parent && parent.children) || [],
				index = siblings.indexOf(this) + 1;
			if (index === 0 || index > siblings.length) {
				return null;
			}
			return this._root._poolFetch(siblings[index]);
		},
		/**
		 * Returns the previous sibling node for this node or null if none exists.
		 * The copy is not on {{#crossLink "hold"}}{{/crossLink}}.
		 * Remember to release the copy to the pool when done.
		 * @method getPreviousSibling
		 * @return FlyweightTreeNode
		 */
		getPreviousSibling: function() {
			var parent = this._iNode._parent,
				siblings = (parent && parent.children) || [],
				index = siblings.indexOf(this) - 1;
			if (index < 0) {
				return null;
			}
			return this._root._poolFetch(siblings[index]);
		},
        /**
         * Sets the focus to this node.
         * @method focus
         * @chainable
         */
        focus: function() {
            return this._root.set(FOCUSED, this);
        },
        /**
         * Removes the focus from this node
         * @method blur
         * @chainable
         */
        blur: function () {
            return this._root.set(FOCUSED, null);
        },
		/**
		 * Sugar method to toggle the expanded state of the node.
		 * @method toggle
		 * @chainable
		 */
		toggle: function() {
			return this.set(EXPANDED, !this.get(EXPANDED));
		},
        /**
         * Sugar method to expand a node
         * @method expand
         * @chainable
         */
        expand: function() {
            return this.set(EXPANDED, true);
        },
        /**
         * Sugar method to collapse this node
         * @method collapse
         * @chainable
         */
        collapse: function() {
            return this.set(EXPANDED, false);
        },
		/**
		 * Returns true if this node is the root node
		 * @method isRoot
		 * @return {Boolean} true if root node
		 */
		isRoot: function() {
			return this._root._tree === this._iNode;
		},
		/**
		* Gets the stored value for the attribute, from either the
		* internal state object, or the state proxy if it exits
		*
		* @method _getStateVal
		* @private
		* @param {String} name The name of the attribute
		* @return {Any} The stored value of the attribute
		*/
		_getStateVal : function(name) {
			var iNode = this._iNode;
			if (this._state.get(name, BYPASS_PROXY) || !iNode) {
				return this._state.get(name, VALUE);
			}
			if (iNode.hasOwnProperty(name)) {
				return iNode[name];
			}
			return this._state.get(name, VALUE);
		},

		/**
		* Sets the stored value for the attribute, in either the
		* internal state object, or the state proxy if it exits
		*
		* @method _setStateVal
		* @private
		* @param {String} name The name of the attribute
		* @param {Any} value The value of the attribute
		*/
		_setStateVal : function(name, value) {
			var iNode = this._iNode;
			if (this._state.get(name, BYPASS_PROXY) || this._state.get(name, 'initializing') || !iNode) {
				this._state.add(name, VALUE, value);
			} else {
				iNode[name] = value;
			}
		}
	},
	{
		/**
		 * Template string to be used to render this node.
		 * It should be overriden by the subclass.
		 *
		 * It contains the HTML markup for this node plus placeholders,
		 * enclosed in curly braces, that have access to any of the
		 * configuration attributes of this node plus several predefined placeholders.
         *
         * It must contain at least three elements identified by their classNames:

         +----------------------------+
         | {cname_node}               |
         | +------------------------+ |
         | | {cname_content}        | |
         | +------------------------+ |
         |                            |
         | +------------------------+ |
         | | {cname_children}       | |
         | +------------------------+ |
         +----------------------------+

         * For example:

         '<div id="{id}" class="{cname_node}" role="" aria-expanded="{expanded}">' +
               '<div tabIndex="{tabIndex}" class="{cname_content}">{label}</div>' +
               '<div class="{cname_children}" role="group">{children}</div>' +
         '</div>'

         * The outermost container identified by the className `{cname_node}`
         * must also use the `{id}` placeholder to set the `id` of the node.
         * It should also have the proper ARIA role assigned and the
         * `aria-expanded` set to the `{expanded}` placeholder.
         *
         * It must contain two further elements:
         *
         * * A container for the contents of this node, identified by the className
         *   `{cname_content}` which should contain everything the user would associate
         *   with this node, such as the label and other status indicators
         *   such as toggle and selection indicators.
         *   This is the element that would receive the focus of the node, thus,
         *   it must have a `{tabIndex}` placeholder to receive the appropriate
         *   value for the `tabIndex` attribute.
         *
         * * The other element is the container for the children of this node.
         *   It will be identified by the className `{cname_children}` and it
         *   should enclose the placeholder `{children}`.
         *
		 * @property TEMPLATE
		 * @type {String}
		 * @default '<div id="{id}" class="{cname_node}" role="" aria-expanded="{expanded}"><div tabIndex="{tabIndex}"
         class="{cname_content}">{label}</div><div class="{cname_children}" role="group">{children}</div></div>'
		 * @static
		 */
		TEMPLATE: '<div id="{id}" class="{cname_node}" role="" aria-expanded="{expanded}">' +
                        '<div tabIndex="{tabIndex}" class="{cname_content}">{label}</div>' +
                        '<div class="{cname_children}" role="group">{children}</div>' +
                   '</div>',
		/**
		 * CCS className constant to use as the class name for the DOM element representing the node.
		 * @property CNAME_NODE
		 * @type String
		 * @static
		 */
		CNAME_NODE: CNAME_NODE,
		/**
		 * CCS className constant to use as the class name for the DOM element that will contain the label and/or status of this node.
		 * @property CNAME_CONTENT
		 * @type String
		 * @static
		 */
		CNAME_CONTENT: CNAME_CONTENT,
		/**
		 * CCS className constant to use as the class name for the DOM element that will contain the children of this node.
		 * @property CNAME_CHILDREN
		 * @type String
		 * @static
		 */
		CNAME_CHILDREN: CNAME_CHILDREN,
		/**
		 * CCS className constant added to the DOM element for this node when its state is not expanded.
		 * @property CNAME_COLLAPSED
		 * @type String
		 * @static
		 */
		CNAME_COLLAPSED: CNAME_COLLAPSED,
		/**
		 * CCS className constant added to the DOM element for this node when its state is expanded.
		 * @property CNAME_EXPANDED
		 * @type String
		 * @static
		 */
		CNAME_EXPANDED: CNAME_EXPANDED,
		/**
		 * CCS className constant added to the DOM element for this node when it has no children.
		 * @property CNAME_NOCHILDREN
		 * @type String
		 * @static
		 */
		CNAME_NOCHILDREN: CNAME_NOCHILDREN,
		/**
		 * CCS className constant added to the DOM element for this node when it is the first in the group.
		 * @property CNAME_FIRSTCHILD
		 * @type String
		 * @static
		 */
		CNAME_FIRSTCHILD: CNAME_FIRSTCHILD,
		/**
		 * CCS className constant added to the DOM element for this node when it is the last in the group.
		 * @property CNAME_LASTCHILD
		 * @type String
		 * @static
		 */
		CNAME_LASTCHILD: CNAME_LASTCHILD,
		/**
		 * CCS className constant added to the DOM element for this node when dynamically loading its children.
		 * @property CNAME_LOADING
		 * @type String
		 * @static
		 */
		CNAME_LOADING: CNAME_LOADING,
		ATTRS: {
			/**
			 * Reference to the FlyweightTreeManager this node belongs to
			 * @attribute root
			 * @type {FlyweightTreeManager}
			 * @readOnly
			 *
			 */

			root: {
				_bypassProxy: true,
				readOnly: true,
				getter: function() {
					return this._root;
				}
			},

			/**
			 * Template to use on this particular instance.
			 * The renderer will default to the static TEMPLATE property of this class
			 * (the preferred way) or the nodeTemplate configuration attribute of the root.
			 * See the TEMPLATE static property.
			 * @attribute template
			 * @type {String}
			 * @default undefined
			 */
			template: {
				validator: Lang.isString
			},
			/**
			 * Label for this node. Nodes usually have some textual content, this is the place for it.
			 * @attribute label
			 * @type {String}
			 * @default ''
			 */
			label: {
				validator: Lang.isString,
				value: ''
			},
			/**
			 * Id to assign to the DOM element that contains this node.
			 * If none was supplied, it will generate one
			 * @attribute id
			 * @type {Identifier}
			 * @default guid()
			 * @readOnly
			 */
			id: {
				readOnly: true
			},
			/**
			 * Returns the depth of this node from the root.
			 * This is calculated on-the-fly.
			 * @attribute depth
			 * @type Integer
			 * @readOnly
			 */
			depth: {
				_bypassProxy: true,
				readOnly: true,
				getter: function () {
					var count = 0,
						iNode = this._iNode;
					while (iNode._parent) {
						count += 1;
						iNode = iNode._parent;
					}
					return count-1;
				}
			},
			/**
			 * Expanded state of this node.
			 * @attribute expanded
			 * @type Boolean
			 * @default true
			 */
			expanded: {
				_bypassProxy: true,
				getter: '_expandedGetter',
				setter: '_expandedSetter'
			}
		}
	}
);
Y.FlyweightTreeNode = FWNode;



}, '@VERSION@', {"requires": ["widget", "base-build"], "skinnable": false});
