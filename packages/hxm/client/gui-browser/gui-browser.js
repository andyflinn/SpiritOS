let spirit = null;   // Global variable

{
    async function initialize() {
        const output = document.getElementById('output');
        output.textContent = 'Sending {} to http://localhost:7777/ ...';

        try {
        const response = await fetch('http://localhost:7777/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        const result = await response.json();

        // Store globally
        spirit = result.state;
        
        output.innerHTML = `<span class="success">Success! Global variable 'spirit' is ready.</span><br><br>` 
                            + JSON.stringify(result.state, null, 2);

            console.log('%c✅ spirit ready!', 'color: lime; font-size: 16px; font-weight: bold');

        } catch (err) {
            output.textContent = 'ERROR: ' + err.message;
            console.error(err);
        }
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

        spirit.console = {

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

            scanProcessorDefault: function(node, pathstack) {
                // with print the a path for this node
                console.log(pathstack.join('.'));
                return;
            },

////////////////////////////////////////////////////////////////////////////

            scanSpiritTree: function(
                processor = spirit.console.scanProcessorDefault, // a node processor function that takes a node and a pathstack as arguments, and processes the node in some way. the pathstack is an array of strings representing the path to the current node in the tree, with the root node being an empty array. the processor function should return nothing.
                node = spirit, // the root object to start scanning from
                pathstack = [], // the current pathstack, used for recursion. should not be set when calling the function, only used internally.    
                depth = 32) {
                
                // if the pathstack length is greater than or equal to the depth parameter,
                // return false to prevent infinite recursion      
                if (pathstack.length >= depth) return false;

                // scan all the child properties of the node object, 
                // and for each child, do the following:
                // call the processor function with the child node and the current pathstack as arguments
                for(const key in node){
                    if(node.hasOwnProperty(key)){
                        const child = node[key];
                        pathstack.push(key);
                        processor(child, pathstack.concat([key]));
                        pathstack.pop();

                    }
                }

            }





////////////////////////////////////////////////////////////////////////////

        }

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////

    }
    
    initialize();
}


