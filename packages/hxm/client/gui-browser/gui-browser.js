
let spirit = null;   // Global variable

{
    const spiritWindow = document.getElementById('spirit');

    async function initialize() {
        
        spiritWindow.textContent = 'Sending {} to http://localhost:7777/ ...';

        try {
        const response = await fetch('http://localhost:7777/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const result = await response.json();

        // Store globally
        spirit = result.state;
        spirit._parentobject = null;
        spirit._childContainer = spiritWindow;
        
        spiritWindow.textContent = JSON.stringify(result.state, null, 2);

        console.log('%c✅ spirit ready!', 'color: lime; font-size: 16px; font-weight: bold');

        } catch (err) {
            spiritWindow.textContent = 'ERROR: ' + err.message;
            console.error(err);
        }
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

        const ICON = {
            ARROWDOWN: '⬇️',
            ARROWLEFT: '⬅️',
            ARROWRIGHT: '➡️',
            ARROWUP: '⬆️',
            OK: '✅',
            DELETE: '❌',
            WARNING: '⚠️',
            INFO: 'ℹ️',
            CHECKED: '☑️',
            UNCHECKED: '⬜',
            LOADING: '⏳',        
            ERROR: '❌',
            POINTRIGHT: '▶️',
            POINTDOWN: '🔽',
            POINTLEFT: '◀️',
            POINTUP: '🔼', 
            BACK: '⬅️',
            FORWARD: '➡️',
            REFRESH: '🔄',
            ADD: '➕',
            REMOVE: '➖',
            EDIT: '✏️',
            VIEW: '👁️',
            HIDDEN: '🙈',
            VISIBLE: '🙉',
            LOCKED: '🔒',
            UNLOCKED: '🔓',
            STAR: '⭐',
            HEART: '❤️',
            BROKENHEART: '💔',
            PURPLEHEART: '💜',
            THUMBSUP: '👍',  
            THUMBSDOWN: '👎',
            FIRE: '🔥',
            WATER: '💧',
            EARTH: '🌍',
            AIR: '💨',
            SUN: '☀️',
            MOON: '🌙',
            CLOUD: '☁️',
            RAIN: '🌧️',
            SNOW: '❄️',
            LIGHTNING: '⚡',
            TREE: '🌳',   
            FLOWER: '🌸',
            ANIMAL: '🐾',
            PERSON: '👤',
            GROUP: '👥',
            MUSIC: '🎵',
            VIDEO: '🎬',
            DOCUMENT: '📄',
            FOLDER: '📁',
            OPEN: '📂',
            LINK: '🔗',
            LOCATION: '📍',
            TIME: '⏰',
            CALENDAR: '📅',
            EMAIL: '✉️',
            PHONE: '📞',
            CHAT: '💬',
            CODE: '💻',
            BUG: '🐛',
            IDEA: '💡',
            CLOUD: '☁️',
            UDLOAD: '⬆️',
            DOWNLOAD: '⬇️',
            EGGPLANT: '🍆',
            VICTORY: '✌️',
            COFFEE: '☕',
            SMOKE: '💨',
            NEEDLE: '🪡',
            THREAD: '🧵',
            NOTE: '📝',
            HOME: '🏠',
            WORK: '🏢',
            SCHOOL: '🏫',
            CAR: '🚗',
            BIKE: '🚲',
            BUS: '🚌',
            TRAIN: '🚆',
            PLANE: '✈️',
            SHIP: '🚢',
            ROCKET: '🚀',
            SATELLITE: '🛰️',
            GLOBE: '🌐',
            OBJECT: '🔲',
            BOX: '📦',
            PACKAGE: '📦',
            SPIRIT: '👻',
            GHOST: '👻',
            WIZARD: '🧙',
            WITCH: '🧙‍♀️',
            TABLE: '📊',
            CHART: '📈',
            GRAPH: '📉',
            BOOK: '📖',
            BATTERY: '🔋',
            KEY: '🔑',
            LOCK: '🔒',
            UNLOCK: '🔓',
            PAUSED: '⏸️',
            PLAY: '▶️',
            STOP: '⏹️',
            RECORD: '⏺️',
            REWIND: '⏪',
            FASTFORWARD: '⏩',
            PAUSE: '⏸️',
            VOLUMEUP: '🔊',
            VOLUMEDOWN: '🔉',
            MUTED: '🔇',
            UNMUTED: '🔈',
            PROTECT: '🛡️',
            SHIELD: '🛡️',
            SWORD: '⚔️',
            GUN: '🔫',
            BOMB: '💣',
            EXPLODE: '💥',
            PRAY: '🙏',
            THANKS: '🙏',
            SLEEP: '😴',
            PARTY: '🥳',
            CELEBRATE: '🎉',
            THINK: '🤔',
            CONFUSED: '😕',
            SAD: '😢',
            HAPPY: '😄',
            ANGRY: '😠',
            LOVE: '❤️',
            GROOVY: '😎',
            DEAD: '💀',
            BIRD: '🐦',
            CAT: '🐱',
            DOG: '🐶',
            MONKEY: '🐒',
            FISH: '🐟',
            MENU: '📋',
            LIST: '📋',
            OFF: '🔴',
            ON: '🟢',
            YES: '✅',
            NO: '❌',
            START: '🔵',
            STOP: '🟠',
            NUMBER: '🔢',
            STRING: '🔤',
            BOOLEAN: '🔘',
            TEXT: '🔤',
            TOGGLE: '🔘',


            END: '🔚' };

        console.log(spirit._containerWindow)        
        
////////////////////////////////////////////////////////////////////////////
       
        spirit.console = {


////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////

            listTypes: function() {
            if (!spirit || !spirit.core || !spirit.core.types) {
                console.error("SpiritOS core types not available");
                return [];
            }

            return Object.keys(spirit.core.types).filter(typeName => {
                const type = spirit.core.types[typeName];
                return type._type === "type";
            });
            },

////////////////////////////////////////////////////////////////////////////

            typeTree: function(){
               // the result object to build up 
               var tree = {};

               // an array of type objects from spirit.core.types
               var list = [];

               // for all members of spirit.core.types, do the following:
               // add a reference to the member object into the list array
                for (const typeName in spirit.core.types) {
                     const type = spirit.core.types[typeName];
                     list.push(type);
                }

                const MAX_TREE_DEPTH = 10; // Prevent infinite loops
                // save the current length of the list array multiplied byMAX_TREE_DEPTH
                // called length
                var counter = list.length * MAX_TREE_DEPTH;
                
                // create a function that recursively scans the tree for a node with the same
               // name as the input string. return the node if found, otherwise return null
               function findNode(node, name){
                    if (node.hasOwnProperty(name)) {return node[name];}
                    // for all members of the node object, do the following:
                   for(const key in node){
                        var n = null;
                        if (( n = findNode(node[key], name)!= null)){
                            return n;
                        };
                   }
                                      // if the node has child nodes, recursively scan them as well
                   
                   return null;
               }

                // make a loop that loops exactly counter times or until the actual length 
                // of the list array is 0, whichever comes first. in each loop, do the following:
                for(var i = 0; i < counter && list.length > 0; i++){

                    // make an inner loop that scans the list exactly once
                    for(var j = 0; j < list.length; j++){
                        if(typeof list[j] !== 'object'){
                            list.splice(j, 1);
                            continue;
                        }
                        // if list[j] does not have a parenttype, continue
                        if(list[j].name == undefined) { 
                            list.splice(j, 1);
                            continue;
                        } 
                        // if list[j] does not have a parenttype, continue
                        //if(list[j].parenttype == undefined) {
                        //    continue;
                        //} 

                        var elementName = list[j].name;
                        var elementParentType = list[j].parenttype;

                        if (elementParentType === null) {
                            tree[elementName] = {};
                            // remove element j from the list array
                            list.splice(j, 1);  
                            break;
                        } else if ((treeNode = findNode(tree, elementParentType)) !== null) {

                            treeNode[elementName] = {};
                            // remove element j from the list array
                            list.splice(j, 1);  
                            break;
                        };

                    }


                }

                return tree;
            }, 

////////////////////////////////////////////////////////////////////////////

            scanProcessorDefault: function(node, pathstack,objectstack) {
                // with print the a path for this node
                console.log(pathstack.join('.'));
                return;
            },

////////////////////////////////////////////////////////////////////////////

            scanProcessorCreateHTML: function(child, pathstack, objectstack) {

                const isObject = typeof child === 'object';
                const isPrimitive = !isObject;
                
                const parentObject = objectstack[objectstack.length-1];
                const parentWindow = child._containerWindow = parentObject._childContainer;

                //parentWindow.style.paddingLeft = '2em';
                parentWindow.style.margin = 0;

                // create a title bar for the child
                const titleBar = document.createElement('pre');
                titleBar.classList.add('titlebar');
                titleBar.style.padding = 0;
                titleBar.style.margin = 0;
                parentWindow.appendChild(titleBar);
                
                // create an icon for the child
                let icon = document.createElement('span');
                icon.classList.add('icon');
                icon.style.paddingRight = '0.5em';
                titleBar.appendChild(icon);
                icon.textContent = ICON.OBJECT;

                // create a title for the child, 
                let title = document.createElement('span');
                title.classList.add('title');
                title.style.paddingRight = '0.5em';
                title.style.fontWeight = 'bold';
                titleBar.appendChild(title);
                
                title.textContent = pathstack[pathstack.length-1] + ':';
           


                // if the child is an object, add an OBJECT icon, otherwise add a STRING icon
                if (typeof child === 'object') {

                    icon.textContent = ICON.POINTRIGHT;

                    // create a parentWindow for the child's children
                    child._childContainer = document.createElement('pre');
                    child._childContainer.classList.add('child-container');
                    parentWindow.appendChild(child._childContainer);
                    child._childContainer.style.display = 'none';
                    child._childContainer.style.padding = 0;
                    child._childContainer.style.paddingLeft = '1em';

                    // the child._childContainer.style.display value is toggled
                    // by clicking on the icon
                    icon.addEventListener('click', function() {
                        if (child._childContainer.style.display === 'none') {
                            child._childContainer.style.display = 'block';
                            icon.textContent = ICON.POINTLEFT;
                        } else {
                            child._childContainer.style.display = 'none';
                            icon.textContent = ICON.POINTRIGHT;
                        }
                    });
                } else {
                    // if node is a string the

                    // for primitives we display the value in the title bar
                    let childValue = document.createElement('span');
                    icon.classList.add('icon');
                    titleBar.appendChild(childValue);

                    // we make sure that the value has all the
                    // typing facilities, before with allow it 
                    // to be manipulated
                    let readonly = true;
                    if (    (child.hasOwnProperty('_flags'))
                        &&  (child.hasOwnProperty('_type'))
                        &&  (child._flags.readonly == false)
                    ) readonly = false;

                    // if have different action now, 
                    // depending on the child being a string, a number, 
                    // a boolean or any other thing
                    if (typeof child === 'string') {
                        icon.textContent = ICON.STRING;
                        childValue.textContent = child;

                    } else if (typeof child === 'number') {
                        icon.textContent = ICON.NUMBER;
                        childValue.textContent = child;

                    } else if (typeof child === 'boolean') {
                        icon.textContent = ICON.BOOLEAN;

                    } else {
                        icon.textContent = ICON.OBJECT;
                    }
                

                    if (isObject)icon.textContent = ICON.POINTRIGHT;
                    else icon.textContent = ICON.STRING;



                }



                return;
            },

////////////////////////////////////////////////////////////////////////////

            scanSpiritTree: function(
                processor = spirit.console.scanProcessorDefault, // a node processor function that takes a node and a pathstack as arguments, and processes the node in some way. the pathstack is an array of strings representing the path to the current node in the tree, with the root node being an empty array. the processor function should return nothing.
                node = spirit, // the root object to start scanning from
                pathstack = [], // the current pathstack, used for recursion. should not be set when calling the function, only used internally.    
                objectstack = [], // the current pathstack, used for recursion. should not be set when calling the function, only used internally.    
                depth = 32) {
                
                // if the pathstack length is greater than or equal to the depth parameter,
                // return false to prevent infinite recursion      
                if (pathstack.length >= depth) return false;

                console.log(pathstack.join('.') 
                    + ' **** tree scan at level ' 
                    + (objectstack.length) 
                );

                objectstack.push(node);
                
                // scan all the child properties of the node object, 
                // and for each child, do the following:
                // call the processor function with the child node and the current pathstack as arguments
                for(const key in node){

                    // if the key is not a string containing only lowercase letters
                    // from 'a' to 'z', skip this key and continue to the next one
                    if (!/^[a-z]+$/.test(key)) continue;

                    if(node.hasOwnProperty(key)){
                        const child = node[key];
                        pathstack.push(key);

                        processor(child, pathstack,objectstack);

                        // the the child is an object, recursively call the 
                        // scanSpiritTree function with the child as the new node, and the current pathstack as the new pathstack

                        if(typeof child === 'object' && child !== null){
                        
                            console.log(pathstack.join('.') + ' **** found an object: key: ' + key );

                            child._parentobject = node;

                            spirit.console.scanSpiritTree(
                                processor, 
                                child, 
                                pathstack, 
                                objectstack, 
                                depth);
                        } else {
                            console.log(pathstack.join('.') + ' **** found a primitive value: ' + child.value);
                        }

                        pathstack.pop();

                    }
                }

                objectstack.pop();
            },

            initializeGUI: function(){
                const titlebar = document.getElementById('titlebar');
                const span = document.createElement('span');
                span.textContent = ICON.SPIRIT + ' SpiritOS';
                titlebar.appendChild(span);
            
                spiritWindow.textContent = '';
                spirit.console.scanSpiritTree(spirit.console.scanProcessorCreateHTML);
            }

////////////////////////////////////////////////////////////////////////////

        }

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

    }
    
    initialize();
}


