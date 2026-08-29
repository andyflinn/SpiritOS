'use strict';

const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');

let result = null;
let jsonResult = null;
let mySpirit = null;

function checkResult(shouldSucceed = true){
    jsonResult = null;
    if (typeof result === 'string'){
        test.showReturnString(result);
        test.check('the return value is a string');

        if (result.length > 0){
            test.check('the string is not empty');
            let retJSON;
            try {
                jsonResult = JSON.parse(result);
                test.check('the return string is VALID json');
                if (typeof jsonResult === 'object'){
                    test.check('the returned string is a json object');
                    if (shouldSucceed){
                        if (jsonResult.hasOwnProperty('error')){
                            test.fail('transformJSON() should NOT return an error object)');
                        } else {
                            test.check('transformJSON() returned "' + result + '"');
                        }

                    }else{
                        if (!jsonResult.hasOwnProperty('error')){
                            test.fail('transformJSON() should have return an error object)');
                        } else {
                            test.check('transformJSON() returned "' + result + '"');
                        }
                    }
                } else {
                    test.fail('the returned string is not an object');
                }
            } catch(err) {
                test.fail('the returned string is INVALID json');
            }
        } else {
            test.fail('but the string is empty');
        }
    } else {
        test.fail('the return value is NOT a string');
    }
}

test.startTest('calling transformJSON("{76{") . this should fail.');
result = spirit.core.util.transformJSON('{76{');
checkResult(false);
test.reportSuccessFailureCount();

test.startTest('calling transformJSON(5984) . this should fail');
result = spirit.core.util.transformJSON(5984);
checkResult(false);
test.reportSuccessFailureCount();

test.startTest('Transform Test 001');
test.subHeading('Fetching the entire SpiritOS kernel object');
test.comment('This test will fetch the entire SpiritOS kernel object and display it in JSON format.');
test.comment('Sending an empty object "{}" to the transform function to get the entire kernel object');
test.lineFeed();

mySpirit = result = spirit.core.util.transformJSON('{}');
checkResult();
test.reportSuccessFailureCount();
