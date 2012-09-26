YUI.add("gallery-flyweight-tree",function(a,g){var d=a.Lang,o=".",b="_default",r=a.ClassNameManager.getClassName,h=function(u){return r("flyweight-tree-node",u);},s=h(""),n=h("children"),i=h("collapsed"),c=h("expanded"),q=h("no-children"),t=h("first-child"),m=h("last-child"),p=h("loading"),f="_bypassProxy",e="value",k=a.Array,j,l;j=function(){this._pool={};this._initialValues={};};j.ATTRS={defaultType:{value:"FlyweightTreeNode"},dynamicLoader:{validator:d.isFunction,value:null}};j.prototype={_tree:null,_pool:null,_domEvents:null,_loadConfig:function(u){var v=this;v._tree={children:a.clone(u)};v._initNodes(this._tree);if(v._domEvents){a.Array.each(v._domEvents,function(w){v.after(w,v._afterDomEvent,v);});}},_initNodes:function(v){var u=this;a.Array.each(v.children,function(w){w._parent=v;w.id=w.id||a.guid();u._initNodes(w);});},_afterDomEvent:function(v){var u=this._poolFetchFromEvent(v);if(u){u.fire(v.type.split(":")[1],{domEvent:v.domEvent});this._poolReturn(u);}},_getTypeString:function(v){var u=v.type||b;if(!d.isString(u)){if(d.isObject(u)){u=u.NAME;}else{throw"Node contains unknown type";}}return u;},_poolFetch:function(x){var v,u=x._held,w=this._getTypeString(x);if(u){return u;}v=this._pool[w];if(v===undefined){v=this._pool[w]=[];}if(v.length){u=v.pop();u._slideTo(x);return u;}return this._createNode(x);},_poolReturn:function(u){if(u._node._held){return;}var v,w=this._getTypeString(u._node);v=this._pool[w];if(v){v.push(u);}},_createNode:function(w){var v,u=w.type||this.get("defaultType");if(d.isString(u)){u=a[u];}if(u){v=new u();if(v instanceof a.FlyweightTreeNode){v._slideTo({});a.Array.each(a.Object.keys(v._state.data),v._addLazyAttr,v);v._root=this;v._slideTo(w);return v;}}return null;},getRoot:function(){return this._poolFetch(this._tree);},_getHTML:function(){var v="",u=this.getRoot();u.forEachChild(function(w,x,y){v+=w._getHTML(x,y.length,0);});this._poolReturn(u);return v;},_findNodeByElement:function(v){var x=v.ancestor(o+l.CNAME_NODE,true).get("id"),w=null,u=function(y){if(y.id===x){w=y;return true;}if(y.children){return a.Array.some(y.children,u);}return false;};if(u(this._tree)){return w;}return null;},_poolFetchFromEvent:function(u){var v=this._findNodeByElement(u.domEvent.target);if(v){return this._poolFetch(v);}return null;},_forSomeCfgNode:function(w,v){v=v||this;var u=function(y,x){return a.Array.some(y.children||[],function(A,z){w.call(v,A,x,z);return u(A,x+1);});};return u(this._tree,0);}};a.FlyweightTreeManager=j;l=a.Base.create("flyweight-tree-node",a.Base,[],{_node:null,_root:null,_getHTML:function(x,E,w){var C=this,u=this._node,B=this.getAttrs(),D="",z=u.template,v=u.children&&u.children.length,A=[s],y=this.constructor;while(!z){z=y.TEMPLATE;y=y.superclass.constructor;}u._rendered=true;if(v){if(B.expanded){u._childrenRendered=true;this.forEachChild(function(F,G,H){D+=F._getHTML(G,H.length,w+1);});A.push(c);}else{A.push(i);}}else{if(this._root.get("dynamicLoader")&&!u.isLeaf){A.push(i);}else{A.push(q);}}if(x===0){A.push(t);}else{if(x===E-1){A.push(m);}}B.children=D;B.cname_node=A.join(" ");B.cname_children=n;return d.sub(z,B);},_slideTo:function(u){this._node=u;this._stateProxy=u;},forEachChild:function(y,x){var u=this._root,w=this._node.children,z,v;x=x||this;if(w&&w.length){k.each(w,function(B,A,C){z=u._poolFetch(B);v=y.call(x,z,A,C);u._poolReturn(z);return v;});}},_expandedGetter:function(){return this._node.expanded!==false;},_expandedSetter:function(y){var v=this,x=v._node,u=v._root,w=a.one("#"+x.id),z=u.get("dynamicLoader");x.expanded=y=!!y;if(z&&!x.isLeaf&&(!x.children||!x.children.length)){this._loadDynamic();return;}if(x.children&&x.children.length){if(y){if(!x._childrenRendered){v._renderChildren();}w.replaceClass(i,c);}else{w.replaceClass(c,i);}}},_loadDynamic:function(){var v=this,u=v._root;a.one("#"+this.get("id")).replaceClass(i,p);u.get("dynamicLoader").call(u,v,a.bind(v._dynamicLoadReturn,v));},_dynamicLoadReturn:function(w){var v=this,x=v._node,u=v._root;if(w){x.children=w;u._initNodes(x);v._renderChildren();}else{x.isLeaf=true;}a.one("#"+x.id).replaceClass(p,(x.isLeaf?q:c));},_renderChildren:function(){var u="",v=this._node,w=this.get("depth");v._childrenRendered=true;this.forEachChild(function(x,y,z){u+=x._getHTML(y,z.length,w+1);});a.one("#"+v.id+" ."+n).setContent(u);},hold:function(){return(this._node._held=this);},release:function(){this._node._held=null;this._root._poolReturn(this);return this;},getParent:function(){var u=this._node._parent;return(u?this._root._poolFetch(u):null);},getNextSibling:function(){var v=this._node._parent,w=(v&&v.children)||[],u=w.indexOf(this)+1;if(u===0||u>w.length){return null;}return this._root._poolFetch(w[u]);},getPreviousSibling:function(){var v=this._node._parent,w=(v&&v.children)||[],u=w.indexOf(this)-1;if(u<0){return null;}return this._root._poolFetch(w[u]);},toggle:function(){this.set("expanded",!this.get("expanded"));return this;},_getStateVal:function(u){var v=this._node;if(this._state.get(u,f)||!v){return this._state.get(u,e);}if(v.hasOwnProperty(u)){return v[u];}return this._state.get(u,e);},_setStateVal:function(u,w){var v=this._node;if(this._state.get(u,f)||this._state.get(u,"initializing")||!v){this._state.add(u,e,w);}else{v[u]=w;}}},{TEMPLATE:'<div id="{id}" class="{cname_node}"><div class="content">{label}</div><div class="{cname_children}">{children}</div></div>',CNAME_NODE:s,CNAME_CHILDREN:n,CNAME_COLLAPSED:i,CNAME_EXPANDED:c,CNAME_NOCHILDREN:q,CNAME_FIRSTCHILD:t,CNAME_LASTCHILD:m,CNAME_LOADING:p,ATTRS:{root:{_bypassProxy:true,readOnly:true,getter:function(){return this._root;}},template:{validator:d.isString},label:{validator:d.isString,value:""},id:{readOnly:true},depth:{_bypassProxy:true,readOnly:true,getter:function(){var v=0,u=this._node;while(u._parent){v+=1;u=u._parent;}return v-1;}},expanded:{_bypassProxy:true,getter:"_expandedGetter",setter:"_expandedSetter"}}});a.FlyweightTreeNode=l;},"@VERSION@",{"requires":["base-base","base-build","classnamemanager"],"skinnable":false});