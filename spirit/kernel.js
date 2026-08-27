// the kernel
// this file 


// constraints on the name of object names
const BASE26_DIGITS = "zabcdefghijklmnopqrstuvwxy";
function isName(str) {
  if (str == null) return false;
  if (str == undefined) return false;
  return /^[a-z]+$/.test(str);
}
function numberToBase26(n) {
  if (n < 0) return null;
  if (n === 0) return "z";

  let result = "";
  let num = n;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = BASE26_DIGITS[remainder + 1] + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}
function base26ToNumber(str) {
  if (!isname(str)) return null;

  let num = 0;
  for (let char of str) {
    const digit = BASE26_DIGITS.indexOf(char);
    if (digit === -1) return null;
    num = num * 26 + digit;
  }
  return num;
}

// 
const spirit = {
  title: 'SpritOS',
  info: {},
  core: {
    type:{},
  }
};

let ancestorArray = spirit.core.type.ancestorArray = function(typename){
  let ancestors = [];

  while (   isName(typename)
        &&  typename != "type"
        &&  spirit.core.type.hasOwnProperty(typename)
        ){
          let type = spirit.core.type[typename];
          ancestors.push(typename);
        
          typename = spirit.core.type[typename].parenttype;
    }
    
    
    
  return ancestors;
  
}

let createType = spirit.core.type.createType = function(name,parenttype){

  console.log("createType(" + name + "," + parenttype + ")");

  // check if input arguments are both valid names
  if (!isName(name)) return null;
  if (!isName(parenttype)) return null;

  // check if spirit.type already had a member
  // called with the key parenttype. if it does,
  // return null
  if (parenttype != "type"){
    if (!spirit.core.type.hasOwnProperty(parenttype)) {
      console.log ("parenttype " + parenttype + " does not exist");
      return null;
    }
  }

  let ptyp = null;
  if (parenttype == "type"){
    ptyp = spirit.core.type;
  } else {
    if (!spirit.core.type.hasOwnProperty(parenttype)) 
      return null;
    ptyp = spirit.core.type[parenttype];
  }

  // get shortcuts to type and parent objects
  let newtype = spirit.core.type[name] = {
    name: name,
    parenttype: parenttype,
  };
  newtype.ancestorArray = ancestorArray(name);


  if (parenttype == "type") return newtype;
    
    // copy all properties from parenttype to name
    for (const key in ptyp){
      if (key == "name" || key == "parenttype" || key == 'ancestorArray') continue;
      if (typeof ptyp[key] === 'function') continue; 
      console.log("copying " + key + " from " + ptyp.name + " to " + name);
      if (newtype.hasOwnProperty(key)) continue;
      newtype[key] = JSON.parse(JSON.stringify(ptyp[key]));
    }

  return newtype;
}

let bool = createType("boolean","type");
{
  bool.value = false;
  bool.validate = function(value){
    if (!(typeof value === 'boolean')) return false;
    return true;
  }
}

let flag = createType("flag","boolean");
{
  flag.value = true;
}

let nostore = createType("nostore","flag");
let immutable = createType("immutable","flag");
let readonly = createType("readonly","flag");
let serveronly = createType("serveronly","flag");

let number = createType("number","type");
{
  number.min = Number.MIN_VALUE;
  number.max = Number.MAX_VALUE;
  number.value = 0;
  number.validate = function(value){
    if (value == null || value == undefined) return false;
    if (!(typeof value === 'number')) return false;
    if (value < number.min || value > number.max) return false;
    return true;
  };
}

let integer = createType("integer","number");
{
  integer.min = Number.MIN_SAFE_INTEGER;
  integer.max = Number.MAX_SAFE_INTEGER;
}

let float = createType("float","number");
{
}

let string = createType("string","type");
{
  string.maxlength = 256;
  string.value = "";
  string.validate = function(value){
    if (value == null || value == undefined) return false;
    if (!(typeof value === 'string')) return false;
    if (value.length > string.maxlength) return false;
    return true;
  }
}

let name = createType("name","string");
{
  name.validate = function(value){
    if (!isName(value)) return false;
    return true;
  }
}

let text = createType("text","string");
{
  text.maxlength = 65536;
}

let js = createType("js","text");
{
  js.validate = function(value){
    try{
      let executeMe = new Function("object", codeString);
    } catch(e){
      return false;
    }
    return true;
  }
}

let object = createType("object","type");
{
  object.value = {};
  object.validate = function(value){
    if (!(typeof value === 'object')) return false;
    return true;
  }
}

// this function must allways be invoked
// using the call function, in order to
// set 'this'
let instantiateTypeName = 
  spirit.instantiateTypeName =
  spirit.info.instantiateTypeName = 
  spirit.core.instantiateTypeName = function(typeName,instanceName){
  
  if (!isName(typeName) || !isName(instanceName)) return null;
  if (this.hasOwnProperty(instanceName)) return null;
  if (!spirit.core.type.hasOwnProperty(typeName)) return null;

  let type = spirit.core.type[typeName];
  let instance = this[instanceName] = {
    name: instanceName,
    type: typeName,
  }

  // copy all properties from parenttype to name
  for (const key in type){
    if (key == "name" || key == "parenttype" || key == 'ancestorArray') continue;
    if (typeof ptyp[key] === 'function') continue; 
    console.log("copying " + key + " from " + ptyp.name + " to " + name);
    if (newtype.hasOwnProperty(key)) continue;
    newtype[key] = JSON.parse(JSON.stringify(ptyp[key]));
  }

  return newtype;

}

module.exports = {
  spirit,
};

