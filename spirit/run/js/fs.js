'use strict';


const UTIL = spirit.core.util;
const FS = spirit.core.fs;

const createType = spirit.core.util.createType;
const defineTypeMember = spirit.core.util.defineTypeMember;

let discobject = UTIL.createType('discobject','object');
discobject.abstract = true;

let file = UTIL.createType('file','object');
defineTypeMember(file,'size','size');
defineTypeMember(file,'string','mimetype');

let folder = UTIL.createArrayType('folder','object');

 // ******************************************************************
 // functions that are generated in a node environment only

if (spirit.core.const.IS_NODE) {

    const NODE = spirit.core.node;
    const fs = NODE.module.fs;

    let scanFolder = NODE.scanFolder = function(path,result = []){
        //UTIL.print('inside of scanFolder "' + path + '"');

        try {
            // Returns an array of fs.Dirent objects
            const entries = fs.readdirSync(path, { withFileTypes: true });

            while (entries.length > 0){
                let entry = entries.shift();

                if (entry.isDirectory()) {

                    let subfolder = entry.parentPath + entry.name + '/';
                    scanFolder(subfolder,result);
                    result.push(entry);

                } else if (entry.isFile()) {
                    result.push(entry);
                }

        }
            
        } catch (err) {
            UTIL.error(err);
        }

        return result;
    } 

    let loadFolder = NODE.loadFolder = function(){

        let result = scanFolder('./');

        UTIL.print('loadFolder is finished');
        UTIL.print(JSON.stringify(result,null,2));

        for (let i = 0 ; i < result.length ; i++){
            let entry = result[i];
            if (entry.isDirectory()) {

                console.log(`📁 Folder: ${entry.parentPath}${entry.name}`);

            } else if (entry.isFile()) {

                console.log(`📄 File: ${entry.parentPath}${entry.name}`);

            }
    }

        return result;
    }

}


//