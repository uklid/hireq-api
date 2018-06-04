//#region CONFIGS
const functions = require('firebase-functions');
const firebase = require('firebase');
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const _ = require('lodash');
const nodemailer = require('nodemailer');
const serviceAccount = require('./hireq-api-firebase-adminsdk-144gq-b3c135d7b0.json');
const jobs = require('./jobs.json');
const tags = require('./tags.json');
const tagsKeys = Object.keys(tags);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://hireq-api.firebaseio.com"
});
const config = {
    apiKey: "AIzaSyBm9uQ4ESMQZzRoF9xUoz-BiArdXNg0MkY",
    authDomain: "hireq-api.firebaseapp.com",
    databaseURL: "https://hireq-api.firebaseio.com",
    projectId: "hireq-api",
    storageBucket: "hireq-api.appspot.com",
    messagingSenderId: "893222093024"
};
const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'uklid.y@gmail.com',
        pass: 'default01',
    },
});
firebase.initializeApp(config);
//#endregion

//#region HELPERS
const authenticate = (req, res, next) =>{
    console.log('Check if request is authorized with Firebase ID token');
    if((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer '))) {
        res.status(403).send({
            "code": "auth/header-error",
            "message": 'No ID token was passed as a Bearer token in the Authorization header. Make sure you authorize your request by providing the following HTTP header: Authorization: Bearer <ID Token>',
        })
        ///'or by passing a "__session" cookie.')
    }
    let idToken;
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } // cookie implements
    admin.auth().verifyIdToken(idToken).then((decodedIdToken) => {
        req.user = decodedIdToken;
        return next();
    }).catch((error) => {
        res.status(403).send(error);
    })
};
const nextTestName = (currentTest) => {
    switch(currentTest) {
        case "cog": return "per"; 
        case "per": return "ss"; 
        case "ss": return "wp"; 
        case "wp": return "finish"; 
        default: return 'current test must be "cog", "per", "ss" or "wp"'; 
    }
};
const arraysEqual = (arr1, arr2) => {
    if(!Array.isArray(arr1) || !Array.isArray(arr2) || arr1.length !== arr2.length)
        return false;
    let _arr1 = arr1.concat().sort();
    let _arr2 = arr2.concat().sort();

    for(let i = 0; i< _arr1.length; i++) {
        if(_arr1[i] !== _arr2[i])
            return false;
    }
    return true;

};
const getMinMax = (x, offset) => { //get max min with [0,100]
    let max = x + offset/2;
    let min = x - offset/2;
    if(max > 100) max = 100;
    if(min < 0) min = 0;
    return {
        "min": min,
        "max": max
    }
}
const manipulateData = (data) => {
    let manipulatedData = {};
    //manipulatedData.category = data.CATEGORIES;
    //manipulatedData.description = data.INFO;
    //manipulatedData.tags = data.TAGS;
    let bound;
    bound = getMinMax(data.COG, data.COG_SD);
    manipulatedData.COG = { "min": bound.min, "max": bound.max }
    //SS
    bound = getMinMax(data.CPN, data.CPN_SD);
    manipulatedData.CPN = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.LOM, data.LOM_SD);
    manipulatedData.LOM = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.PCS, data.PCS_SD);
    manipulatedData.PCS = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.PEW, data.PEW_SD);
    manipulatedData.PEW = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.PIS, data.PIS_SD);
    manipulatedData.PIS = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.PPM, data.PPM_SD);
    manipulatedData.PPM = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.SMC, data.SMC_SD);
    manipulatedData.SMC = {"min": bound.min, "max": bound.max}
    //WP
    bound = getMinMax(data.WCEO, data.WCEO_SD);
    manipulatedData.WCEO = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.WCII, data.WCII_SD);
    manipulatedData.WCII = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.WIAM, data.WIAM_SD);
    manipulatedData.WIAM = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.WICH, data.WICH_SD);
    manipulatedData.WICH = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.WPAM, data.WPAM_SD);
    manipulatedData.WPAM = {"min": bound.min, "max": bound.max}

    bound = getMinMax(data.WPPM, data.WPPM_SD);
    manipulatedData.WPPM = {"min": bound.min, "max": bound.max}

    //console.log(manipulatedData);

    return manipulatedData;
}
//#endregion

//#region API DECLARATIONS
const usersAPI = express();
const jobsAPI = express();
const candidatesAPI = express();


usersAPI.use(cors());
jobsAPI.use(cors());
candidatesAPI.use(cors());
//#endregion

//#region GLOBAL VARIABLES
const usersRef = admin.database().ref('users');
const jobsRef = admin.database().ref('jobs');
const positionsRef = admin.database().ref('positions');
const candidatesRef = admin.database().ref('candidates');
const poolsRef = admin.database().ref('pools');
//#endregion

//#region USER API

usersAPI.post('/:userId/positions', authenticate, (req,res) => {
    const userId = req.params.userId;
    const pushKey = positionsRef.push().key;
    let data = req.body;
    data.updatedTime = Date.now();
    data.createdTime = Date.now();
    data.createdUser = userId;
    usersRef.child(`${userId}/positions/${pushKey}`).set(true);
    positionsRef.child(pushKey).set(data).then(() => {
        res.status(200).send({
            "message": "Position Added Successfully.",
            "code": pushKey
        });
        return;
    }).catch(error => {
        res.status(500).send(error);
        return;
    });
    
});
usersAPI.get('/:userId/positions', authenticate, (req, res) => {
    const userId = req.params.userId;
    let positions = {};
    usersRef.child(`${userId}/positions`).once('value', userPositionsSnapshot => {
        positionsRef.once("value", positionsSnapshot => {
            if(userPositionsSnapshot.exists()) {
                Object.keys(userPositionsSnapshot.val()).forEach(element => {
                    positions[element] = positionsSnapshot.child(element).val();
                });
            }
        }).then(()=> {
            res.status(200).send(positions);
            return;
        }).catch((error) => {
            res.status(500).send(`error reading positions for user: ${positionId}, ERROR: ${error}` );
            return;
        });
    });
});
usersAPI.get('/:userId/positions/:positionId', authenticate, (req, res) => {
    //const userId = req.params.userId;
    const positionId = req.params.positionId;
    positionsRef.child(positionId).once('value', snapshot => {
        if(snapshot.exists()) {
            res.status(200).send(snapshot.val());
        } else {
            res.status(500).send('invalid position Id');
        }
    });
});
usersAPI.put('/:userId/positions/:positionId', authenticate, (req, res) => {
    const userId = req.params.userId;
    const positionId = req.params.positionId;
    let data = req.body;
    data.updatedTime = Date.now();
    data.createdDate = Date.now();
        positionsRef.child(positionId).once('value', snapshot => {
        if(snapshot.exists()) {
            positionsRef.child(positionId).update(req.body).then(()=> {
                res.status(200).send(`update position successful. key: ${positionId}`);
                return;
            }).catch(error => {
                res.status(500).send(error);
                return;
            });
        } else {
            res.status(500).send(`invalid position id. key: ${positionId}`);
        }
    });
});
usersAPI.post('/login', (req, res) => {  
    if((!req.headers.authorization || !req.headers.authorization.startsWith('Basic '))) {
        res.status(403).send({
            "code": "auth/header-error",
            "message": 'No email and password was passed as a Basic in the Authorization header. Make sure you authorize your request by providing the following HTTP header: Authorization: Basic <hashed email and password>',
        })
    }
    //console.log(req.headers.authorization);
    const decoded = new Buffer(req.headers.authorization.split('Basic ')[1], 'base64'); //encoded by btoa
    const email = decoded.toString().split(':')[0];
    const password = decoded.toString().split(':')[1];
    firebase.auth().signInWithEmailAndPassword(email, password).then((result) => {
        res.status(200).send(result.user);
        return;
    }).catch((error) => {
        res.status(403).send(error);
        return;
    })

    
});
//#endregion

//#region JOBS API
jobsAPI.get('/search', authenticate, (req, res) => {
    let query = req.query;
    if(!req.query.limits) query.limit = 999999;
    if(!req.query.page) query.page = 1;
    if(query.keyword && query.limit && query.page && query.limit > 0 && query.page > 0) {        
        const keywordRegex = new RegExp(query.keyword, "i");
        const resultTagKeys = tagsKeys.filter(x=>x.search(keywordRegex) !== -1);
        let results = [];
        resultTagKeys.forEach(key => {
            Object.keys(tags[key]).forEach(item => {
                if(results.indexOf(item) === -1) results.push(item);
            });
        });
        results.sort();
        const lastResultsIndex = results.length - 1;

        const firstIndex = (query.limit * query.page) - query.limit;
        const lastIndex = firstIndex + parseInt(query.limit) - 1;
        let finalResults = [];
        if(firstIndex <= lastResultsIndex) {
            if(lastIndex <= lastResultsIndex) {
                results.slice(firstIndex, lastIndex+1).forEach(item => {
                    if(jobs[item]) {
                        console.log(manipulateData(job[item]));
                        finalResults.push({"name": item, "category": jobs[item].CATEGORIES, "descriptions": jobs[item].INFO, "tags": jobs[item].TAGS, "info": manipulateData(jobs[item])});
                    }
                });
            } else {
                results.slice(firstIndex, lastResultsIndex+1).forEach(item => {
                    if(jobs[item]) {
                        console.log(manipulateData(jobs[item]));
                        finalResults.push({"name": item, "category": jobs[item].CATEGORIES, "descriptions": jobs[item].INFO, "tags": jobs[item].TAGS, "info": manipulateData(jobs[item])});
                    }
                });
            }
            res.status(200).send(finalResults);
            return;
        } else {
            res.status(200).send("No results found");
            return;
        }
    } else {
        res.status(500).send('Querystring must contains "keyword", "limit" (>0) and "page" (>0)');
        return;
    }
});
jobsAPI.get('/:jobName', authenticate, (req, res) => {
    const jobName = req.params.jobName;
    jobsRef.child(jobName).once('value', snapshot => {
        console.log(snapshot);
        if(snapshot.exists()) {
            res.status(200).send(snapshot.val());
        } else {
            res.status(500).send('invalid job name');
        }
    })
});
//#endregion

//#region CANDIDATES API
candidatesAPI.get('/:candidateId/test', (req, res) => {
    const candidateId = req.params.candidateId;
    candidatesRef.child(candidateId).once('value', snapshot => {
        if(snapshot.exists()) { //id exists
            const candidate = snapshot;
            var tests = candidate.child('tests');
            console.log(tests.val().currentItem);
            if(tests.val().startedTime) { //already start
                let updateItem = tests.val();
                updateItem['name'] = snapshot.child('name').val();
                positionsRef.child(snapshot.child('position').val()).once('value', positionSnapshot=>{
                    updateItem['position'] = positionSnapshot.child('name').val();
                    res.status(200).send(updateItem);
                    return;
                })
            } else { //fresh start
                console.log(tests.val());
                var updateItem = {
                    "startedTime": Date.now(),
                    "updatedTime": Date.now(),
                    "currentTest": "cog",
                    "currentItem": 1
                }
                candidatesRef.child(candidateId).child('tests').update(updateItem);
                updateItem['cog'] = tests.child('cog').val();
                updateItem['per'] = tests.child('per').val();
                updateItem['ss'] = tests.child('ss').val();
                updateItem['wp'] = tests.child('wp').val();
                updateItem['name'] = snapshot.child('name').val();
                positionsRef.child(snapshot.child('position'.val())).once('value', positionSnapshot=>{
                    updateItem['position'] = positionSnapshot.child('name').val();
                    res.status(200).send(updateItem);
                    return;
                }).catch((error)=>{
                    res.status(500).send(error);
                    return;
                });
                
            }
        } else {
            res.status(500).send('candidate "id" not found')
            return;
        }
    })
});

candidatesAPI.post('/:candidateId/answer', (req, res) => {
    const candidateId = req.params.candidateId;

    const testName = req.body.testName;
    const testNumber = req.body.testNumber;
    const answer = req.body.answer;
    console.log('candidate answer started...');
    console.log(`candidate ${candidateId} answered: ${req.body.testName} ${req.body.testNumber} ${req.body.answer}`);
    candidatesRef.child(candidateId).once('value', snapshot => {
        if(snapshot.exists()) {
            const lastTestNumber = snapshot.child('tests').child(testName).numChildren();
            if(typeof answer !== 'number') {
                res.status(500).send('"answer" must be number')
                return;
            }
            if(answer > 5 || answer < 1) {
                res.status(500).send('"answer" must be number in range [1,5]')
                return;
            }
            if(typeof testNumber !== 'number') {
                res.status(500).send('"testNumber" must be number')
                return;
            }
            if(testNumber > lastTestNumber) {
                res.status(500).send(`"testNumber" must be less than or equal ${lastTestNumber}`);
                return;
            }
            var updates = {};
            updates[`${candidateId}/tests/${testName}/${testNumber-1}/a`] = answer;
            updates[`${candidateId}/tests/${testName}/${testNumber-1}/answerTime`] = Date.now();

            if(testNumber === lastTestNumber) {
                if(testName === "cog") {
                    updates[`${candidateId}/tests/currentItem`] = 1;
                    updates[`${candidateId}/tests/currentTest`] = nextTestName(testName);
                    updates[`${candidateId}/tests/updatedTime`] = Date.now();
                    candidatesRef.update(updates).then(() => {
                        let result = {
                            "nextTestName": nextTestName(testName),
                            "nextTestNumber": 1,
                            "page": 1,
                        }
                        console.log('result1:', result);
                        res.status(200).send(result);
                        return;
                    }).catch( error => {
                        console.log('error1:', error);
                        res.status(500).send(`update database error == cog last number: ${error}`);
                        return;
                    })
                    return;
                } else { //TEST !== cog
                    updates[`${candidateId}/tests/currentItem`] = testNumber + 1;
                updates[`${candidateId}/tests/updatedTime`] = Date.now();
                candidatesRef.update(updates).then(() => {
                    let page = ((testNumber-1) - ((testNumber-1) % 10)) / 10;
                    let testValue = snapshot.child('tests').child(testName).val();
                    testValue[(testNumber-1).toString()].a = answer;
                    if(testName !== "cog") {
                        testValue[(testNumber-1).toString()].a = answer; //mock up answer
                        let arrayOfTests = _.range(page*10, (page*10) + 10, 1); //assume test items / 10 = 0  
                        let completedItems = [];
                        Object.keys(testValue).forEach(element => {
                            if(arrayOfTests.includes(parseInt(element))) {
                                if(testValue[element].a) {
                                    completedItems.push(parseInt(element));
                                }
                            }
                        });   
                        if(arraysEqual(arrayOfTests, completedItems)) {
                            page++;
                        }
                    }
                    candidatesRef.child(`${candidateId}/tests`).update({"currentPage": page+1});
                    //check test completion
                    let arrayOfAllTests = _.range(0, snapshot.child(`tests/${testName}`).numChildren(),1);
                    let completedAllItems = [];
                    testValue[(testNumber-1).toString()] = {"a": answer}; ////--------------------HERERE
                    Object.keys(testValue).forEach(element => {
                        if(testValue[element].a) {
                            completedAllItems.push(parseInt(element));
                        }
                    });
                    console.log('test!= cog and not last number arrayOfAllTests: ', arrayOfAllTests);
                    console.log('test!= cog and not last number completedAllItems', completedAllItems);
                    if(arraysEqual(arrayOfAllTests, completedAllItems)) { //complete test
                        let completedUpdates = {};
                        completedUpdates[`${candidateId}/tests/currentItem`] = 1;
                        completedUpdates[`${candidateId}/tests/updatedTime`] = Date.now();
                        completedUpdates[`${candidateId}/tests/currentTest`] = nextTestName(testName);
                        completedUpdates[`${candidateId}/tests/currentPage`] = 1;
                        candidatesRef.update(completedUpdates).then(()=> {
                            let result = {
                                "nextTestName": nextTestName(testName),
                                "nextTestNumber": 1,
                                "page":1
                            }
                            console.log('result2: ',result);
                            res.status(200).send(result);
                            return;
                        }).catch((error) => {
                            console.log('error2: ',error);
                            res.status(500).send(`update database error all test !== cog ${error}`);
                            return;
                        })
                    }
                    let result = {
                        "nextTestName": testName,
                        "nextTestNumber": testNumber + 1,
                        "page": page + 1
                    }
                    console.log('result3: ',result);
                    res.status(200).send(result);
                    return;
                }).catch( error => {
                    console.log('error3: ', error);
                    res.status(500).send(`update database error last number: ${error}`);
                    return;
                })
                }
            } else { //not last number of test
                updates[`${candidateId}/tests/currentItem`] = testNumber + 1;
                updates[`${candidateId}/tests/updatedTime`] = Date.now();
                updates[`${candidateId}/tests/currentTest`] = testName;
                candidatesRef.update(updates).then(() => {
                    let page = ((testNumber-1) - ((testNumber-1) % 10)) / 10;
                    let testValue = snapshot.child('tests').child(testName).val();
                    if(testName !== "cog") {
                        testValue[(testNumber-1).toString()].a = answer; //mock up answer
                        let arrayOfTests = _.range(page*10, (page*10) + 10, 1); //assume test items / 10 = 0  
                        let completedItems = [];
                        testValue[(testNumber-1).toString()].a = answer;
                        Object.keys(testValue).forEach(element => {
                            if(arrayOfTests.includes(parseInt(element))) {
                                if(testValue[element].a) {
                                    completedItems.push(parseInt(element));
                                }
                            }
                        });   
                        if(arraysEqual(arrayOfTests, completedItems)) {
                            page++;
                        }
                    }
                    candidatesRef.child(`${candidateId}/tests`).update({"currentPage": page+1});
                    //check test completion
                    let arrayOfAllTests = _.range(0, snapshot.child(`tests/${testName}`).numChildren(),1);
                    let completedAllItems = [];
                    
                    console.log('testValue:', testValue);
                    testValue[(testNumber-1).toString()].a = answer;
                    Object.keys(testValue).forEach(element => {
                        if(testValue[element].a) {
                            completedAllItems.push(parseInt(element));
                        }
                    });
                    console.log('completedAllItems: ',completedAllItems);
                    console.log('arrayOfAllTests: ', arrayOfAllTests);
                    if(arraysEqual(arrayOfAllTests, completedAllItems)) { //complete test
                        console.log('if completed test...');
                        let completedUpdates = {};
                        completedUpdates[`${candidateId}/tests/currentItem`] = 1;
                        completedUpdates[`${candidateId}/tests/updatedTime`] = Date.now();
                        completedUpdates[`${candidateId}/tests/currentTest`] = nextTestName(testName);
                        completedUpdates[`${candidateId}/tests/currentPage`] = 1
                        candidatesRef.update(completedUpdates).then(()=> {
                            let result = {
                                "nextTestName": nextTestName(testName),
                                "nextTestNumber": 1,
                                "page":1
                            }
                            console.log('result4: ',result);
                            res.status(200).send(result);
                            return;
                        }).catch((error) => {
                            console.log('error4: ',error);
                            res.status(500).send(`update database error allcompleted not last number${error}`);
                            return;
                        })
                        return;
                    } else {
                        let result = {
                            "nextTestName": testName,
                            "nextTestNumber": testNumber + 1,
                            "page": page + 1
                        }
                        console.log('result5: ',result);
                        res.status(200).send(result);
                        return;
                    }
                }).catch( error => {
                    console.log('error5: ',error)
                    res.status(500).send(`update database error not last number: ${error}`);
                    return;
                })
            }

        } else {
            res.status(500).send('candidate id not found')
            return;
        }
    });
});
usersAPI.put('/:userId/positions/:positionId/candidates/:candidateId', authenticate, (req, res) => {
    const userId = req.params.userid;
    const positionId = req.params.positionId;
    const candidateId = req.params.candidateId;
    let data = req.body;
    data.updatedTime = Date.now();
    candidatesRef.child(candidateId).once('value', snapshot => {
        if(snapshot.exists()) {
            candidatesRef.child(candidateId).update(req.body).then(() => {
                res.status(200).send(`update candidate successful. key: ${candidateId}`);
                return;
            }).catch((error) => {
                res.status(500).send(error);
                return;
            });
        } else {
            res.status(500).send(`invalid candidate id. key: ${candidateId}`);
            return;
        }
    });
});
usersAPI.get('/:userId/candidates', authenticate, (req, res) => {
    const userId = req.params.userId;
    let filteredCandidates = {};
    candidatesRef.once('value', snapshot => {
        const candidates = snapshot.val();
        Object.keys(candidates).forEach(element => {
            const candidate = candidates[element];
            if(candidate.createdUser && candidate.createdUser === userId) {
                filteredCandidates[element] = candidate;
                filteredCandidates[element].candidateId = element;
            }
        });
    }).then(()=> {
        res.status(200).send(filteredCandidates);
        return;
    }).catch((error) => {
        res.status(500).send(error);
        return;
    });
});
usersAPI.post('/:userId/positions/:positionId/candidates', authenticate, (req, res) => {
    const userId = req.params.userId;
    const positionId = req.params.positionId;
    const pushKey = candidatesRef.push().key;
    let data = req.body;
    if(!data.name || !data.email) {
        res.status(500).send('data must contains "name" and "email".');
        return;
    }
    data.updatedTime = Date.now();
    data.createdTime = Date.now();
    data.createdUser = userId;
    data.position = positionId;
    data.emailSent = false;

    candidatesRef.child(pushKey).set(req.body).then(() => {
        usersRef.child(`${userId}/positions/${positionId}/candidates/${pushKey}`).set(true).then(()=> {
            positionsRef.child(`${positionId}/candidates/${pushKey}`).set(true).then(()=> {
                res.status(200).send(`create candidate successful. key: ${pushKey}`);
                return;
            }).catch((error) => {
                res.status(500).send(error);
                return;
            });
            return;
        }).catch(error => {
            res.status(500).send(error);
            return;
        });
        return;
    }).catch(error => {
        res.status(500).send(error);
        return;
    });
});
usersAPI.get('/:userId/positions/:positionId/candidates', authenticate, (req, res) => {
    const userId = req.params.userId;
    const positionId = req.params.positionId;
    let candidates = {};
    usersRef.child(`${userId}/positions/${positionId}/candidates`).once('value', positionCandidatesSnapshot => {
        console.log(positionCandidatesSnapshot.val())
        candidatesRef.once('value', candidatesSnapshot => {
            //console.log(`${userId}/positions/${positionId}/candidates`);
            //console.log("positioncandidatesnapshot",positionCandidatesSnapshot.val());
            if(positionCandidatesSnapshot.exists()) {
                Object.keys(positionCandidatesSnapshot.val()).forEach(element => {
                    candidates[element] = candidatesSnapshot.child(element).val();
                    candidates[element].candidateId = element;
                });
            }
        }).then(()=> {
            res.status(200).send(candidates);
            return;
        }).catch((error) => {
            res.status(500).send(error);
            return;
        });
    });
});
usersAPI.delete('/:userId/candidates/:candidateId', authenticate, (req, res) => {
    const userId = req.params.userId;
    const candidateId = req.params.candidateId;
    candidatesRef.child(candidateId).once('value', snapshot => {
        if(snapshot.exists()) {
            const positionId = snapshot.val().position;
            positionsRef.child(`${positionId}/candidates/${candidateId}`).remove();
            usersRef.child(`${userId}/positions/${positionId}/candidates/${candidateId}`).remove();
            candidatesRef.child(candidateId).remove();
            res.status(200).send(`delete candidate success id: ${candidateId}`);
            return
        }else {
            res.status(500).send(`invalid candidate id: ${candidateId}`);
            return;
        }
    }).catch((error)=> {
        res.status(500).send(`delete error candidate id: ${candidateId}`);
        return;
    });  
});
usersAPI.post('/:userId/candidates/email', authenticate, (req,res) => {
    const userId = req.params.userId;
    const data = req.body;
    if(!data.candidateId) {
        res.status(500).send('please provide candidateId');
        return;
    }else {
        candidatesRef.child(data.candidateId).once('value', snapshot => {
            if(snapshot.exists()){
                const email = snapshot.val().email;
                const name = snapshot.val().name;
                const mailOptions = {
                    from: 'hireQ.io <noreply@firebase.com?',
                    to: email,
                };
                mailOptions.subject = `test available from hireQ.io`
                mailOptions.text = `Hello, ${name} you're link to hireq Test is here: http://localhost:3000/candidate?id=${data.candidateId}`
                mailTransport.sendMail(mailOptions).then(() => {
                    candidatesRef.child(`${data.candidateId}/emailSent`).set(true);
                    candidatesRef.child(`${data.candidateId}/sentDate`).set(Date.now());
                    res.status(200).send(`send invitation email to: ${email} completed`);
                    return;
                }).catch((error) => {
                    console.log('ERROR SENDING EMAIL...', error);
                    res.status(500).send(error);
                    return;
                });
            } else {
                console.log('ERROR SENDING EMAIL..., INVALID CANDIDATE ID');
                res.status(500).send('invalid candidate id');
                return;
            }
        });
    }
});
usersAPI.get('/:userId/candidates/:candidateId', authenticate, (req, res) => {
    const candidateId = req.params.candidateId;
    candidatesRef.child(candidateId).once('value', snapshot => {
        if(snapshot.exists()) {
            res.status(200).send(snapshot.val());
            return;
        } else {
            res.status(500).send(`invalida candidate id: ${candidateId}`);
            return;
        }
    });
});

//#endregion

//region FIREBASE MONITORING
function shuffleArray(a) {
    let j, x, i;
    for(i = a.length - 1; i >= 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        if (j < a.length) {
            x = a[i];
            if (x !== null) {
                a[i] = a[j];
                a[j] = x;
            }
        }
    }
    return a;
}
function shuffleDict(a) {
    let j, x, i;
    for (i = a.length - 1; i >= 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        if (j < a.length) {
            x = a[i];
            if (x !== null) {
                a[i] = a[j];
                a[j] = x;
            }
        }
    }
}
function shuffleStatement(dict) {
    for(const key in dict) {
        shuffleDict(dict[key]);
    }
    return dict;
}
function convertTo2Digits(number) {
    const str = "" + number;
    const pad = "00";
    return pad.substring(0, pad.length - str.length) + str;
}
exports.createFullTest = functions.database.ref('/candidates/{pushId}')
    .onCreate((snapshot, context) => {
        poolsRef.once('value', snapshot => {
            const selections = [4, 6, 6, 8, 13, 4, 5, 8, 5, 4,
                                6, 6, 4, 5, 5, 4, 7, 12, 10, 5,
                                5, 6, 7, 7, 5, 6, 4, 3, 4, 3,
                                4, 5, 3, 6, 4, 4, 4, 3, 3, 3,
                                3, 3, 2, 4, 2, 4, 3, 3, 3, 4
                                ]
            let choices = [1,2,3,4,5];
            const start = Math.floor((Math.random()*2)+1);
            const cogTest = [];
            let index = 0;
            let countIndex = 1;
            choices = shuffleArray(choices);
            let s = Math.floor((Math.random()*selections[index])) + 1;
            let cs = [];
            for(let i = 0; i < 5; i++) {
                cs.push({
                    c: choices[i],
                    img: 'Q' + convertTo2Digits(index+1) + '-' + convertTo2Digits(s) + '-' + convertTo2Digits(choices[i]+1) + '.jpg'
                });
            }
            let cogSet = {
                q: index + 1,
                img: 'Q' + convertTo2Digits(index+1) + '-' + convertTo2Digits(s) + '-01.jpg',
                s: s,
                cs: cs
            }
            cogTest.push(cogSet);
            index = start;
            while(countIndex < 20) {
                choices = [1,2,3,4,5];
                choices = shuffleArray(choices);
                s = Math.floor((Math.random()*selections[index])) + 1;
                cs = [];
                for(let i=0; i<5; i++) {
                    cs.push({
                        c: choices[i],
                        img: 'Q' + convertTo2Digits(index+1) + '-' + convertTo2Digits(s) + '-' + convertTo2Digits(choices[i]+1) + '.jpg'
                    });
                }
                cogSet = {
                    q: index +1 ,
                    img: 'Q' + convertTo2Digits(index+1) + '-' + convertTo2Digits(s) + '-01.jpg',
                    s: s,
                    cs: cs
                }
                cogTest.push(cogSet);
                index += 2;
                countIndex++;
            }

            let perAll = shuffleStatement(snapshot.child('per').val());
            let perTest = [];
            Object.keys(perAll).forEach(perTrait => {
                let perTraitArray = shuffleStatement(perAll[perTrait]);
                Object.keys(perTraitArray.slice(0,10)).forEach(item => { //10item each trait
                    perAll[perTrait][item].trait = perTrait;
                    perTest.push(perAll[perTrait][item])
                })
            });
            perTest = shuffleArray(perTest);

            let ssAll = shuffleStatement(snapshot.child('ss').val());
            let ssTest = [];
            Object.keys(ssAll).forEach(ssTrait => {
                let ssTraitArray = shuffleStatement(ssAll[ssTrait]);
                Object.keys(ssTraitArray.slice(0,10)).forEach(item => { //10item each trait
                    ssAll[ssTrait][item].trait = ssTrait;
                    ssTest.push(ssAll[ssTrait][item])
                })
            });
            ssTest = shuffleArray(ssTest);

            let wpAll = shuffleStatement(snapshot.child('wp').val());
            let wpTest = [];
            Object.keys(wpAll).forEach(wpTrait => {
                let wpTraitArray = shuffleStatement(wpAll[wpTrait]);
                Object.keys(wpTraitArray.slice(0,10)).forEach(item => { //10item each trait
                    wpAll[wpTrait][item].trait = wpTrait;
                    wpTest.push(wpAll[wpTrait][item])
                })
            });
            wpTest = shuffleArray(wpTest);

            let allTest = {};
            allTest.cog = cogTest;
            allTest.per = perTest;
            allTest.ss = ssTest;
            allTest.wp = wpTest;
            candidatesRef.child(`${context.params.pushId}/tests`).set(allTest).then(()=>{
                console.log(`create test for candidate ${context.params.pushId}`);
                return;
            }).catch((error) => {
                console.log(error);
                return;
            });
        });
        console.log(`creating test for: ${context.params.pushId}`);
        return;
    });

exports.checkFinished = functions.database.ref('/candidates/{pushId}/tests/finished')
    .onCreate((snapshot, context) => {
    candidatesRef.child(`${context.params.pushId}/tests`).once('value', testsSnapshot => {
        const tests = testsSnapshot.val();
        const cogs = tests.cog;
        const pers = tests.per;
        const sses = tests.ss;
        const wps = tests.wp;
        //COG
        let cogScore = 0;
        Object.keys(cogs).forEach(item => {
            if(cogs[item].a) {
                if(cogs[item].a === 1) {
                    cogScore += 1;
                }
            }
        });
        let cogScoreFinal = (cogScore * 100) / cogs.length;
        //PER
        let perScore = {
            "agreeableness": 0,
            "competitiveness": 0,
            "conscientiousness": 0,
            "desireToLearn": 0,
            "emotionality": 0,
            "extraversion": 0,
            "mastery": 0,
            "otherReferencedGoals": 0,
            "selfEfficacy": 0,
            "worry": 0
        }
        let perScoreSD = {
            "agreeableness": 0,
            "competitiveness": 0,
            "conscientiousness": 0,
            "desireToLearn": 0,
            "emotionality": 0,
            "extraversion": 0,
            "mastery": 0,
            "otherReferencedGoals": 0,
            "selfEfficacy": 0,
            "worry": 0
        }
        let perScoreZ = {
            "agreeableness": 0,
            "competitiveness": 0,
            "conscientiousness": 0,
            "desireToLearn": 0,
            "emotionality": 0,
            "extraversion": 0,
            "mastery": 0,
            "otherReferencedGoals": 0,
            "selfEfficacy": 0,
            "worry": 0
        }
        let perScoreZScal = {
            "agreeableness": 0,
            "competitiveness": 0,
            "conscientiousness": 0,
            "desireToLearn": 0,
            "emotionality": 0,
            "extraversion": 0,
            "mastery": 0,
            "otherReferencedGoals": 0,
            "selfEfficacy": 0,
            "worry": 0
        }
        Object.keys(pers).forEach(item => {
            perScore[pers[item].trait] += pers[item].a;
        });
        let perSum = 0;
        //perMean
        Object.keys(perScore).forEach(item => {
            perSum += perScore[item];
        });
        let perMean = perSum/Object.keys(perScore).length
        //perScoreSD
        let perDiffSqrt = 0;
        Object.keys(perScore).forEach(item => {
            perDiffSqrt += Math.pow((perScore[item]-perMean),2);
        });
        let perSD = Math.sqrt((perDiffSqrt)/(Object.keys(perScore).length - 1))
        //perScoreZ
        Object.keys(perScore).forEach(item => {
            perScoreZ[item] = (perScore[item] - perMean)/perSD;
            if(perScoreZ[item] > 2 ) { perScoreZ[item] = 2;}
            if(perScoreZ[item] < -2) { perscoreZ[item] = -2;}
        });
        //perScoreZScal
        Object.keys(perScore).forEach(item => {
            perScoreZScal[item] = (perScoreZScal[item]+2)*25;
        });
        //SS
        let ssScore = {
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }
        let ssScoreSD = {
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }
        let ssScoreZ = {
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }
        let ssScoreZScal = {
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }
        Object.keys(sses).forEach(item => {
            ssScore[sses[item].trait] += sses[item].a;
        });
        let ssSum = 0;
        //ssMean
        Object.keys(ssScore).forEach(item => {
            ssSum += ssScore[item];
        });
        let ssMean = ssSum/Object.keys(ssScore).length
        //ssScoreSD
        let ssDiffSqrt = 0;
        Object.keys(ssScore).forEach(item => {
            ssDiffSqrt += Math.pow((ssScore[item]-ssMean),2);
        });
        let ssSD = Math.sqrt((ssDiffSqrt)/(Object.keys(ssScore).length - 1))
        //ssScoreZ
        Object.keys(ssScore).forEach(item => {
            ssScoreZ[item] = (ssScore[item] - ssMean)/ssSD;
            if(ssScoreZ[item] > 2 ) { ssScoreZ[item] = 2;}
            if(ssScoreZ[item] < -2) { ssScoreZ[item] = -2;}
        });
        //ssScoreZScal
        Object.keys(ssScore).forEach(item => {
            ssScoreZScal[item] = (ssScoreZScal[item]+2)*25;
        });

        //WP
        let wpScore = {
            "WCEO": 0,
            "WCII": 0,
            "WIAM": 0,
            "WICH": 0,
            "WPAM": 0,
            "WPPM": 0,
        }
        let wpScoreSD = {
            "WCEO": 0,
            "WCII": 0,
            "WIAM": 0,
            "WICH": 0,
            "WPAM": 0,
            "WPPM": 0,
        }
        let wpScoreZ = {
            "WCEO": 0,
            "WCII": 0,
            "WIAM": 0,
            "WICH": 0,
            "WPAM": 0,
            "WPPM": 0,
        }
        let wpScoreZScal = {
            "WCEO": 0,
            "WCII": 0,
            "WIAM": 0,
            "WICH": 0,
            "WPAM": 0,
            "WPPM": 0,
        }
        Object.keys(wps).forEach(item => {
            wpScore[wps[item].trait] += wps[item].a;
        });
        let wpSum = 0;
        //wpMean
        Object.keys(wpScore).forEach(item => {
            wpSum += wpScore[item];
        });
        let wpMean = wpSum/Object.keys(wpScore).length
        //wpScoreSD
        let wpDiffSqrt = 0;
        Object.keys(wpScore).forEach(item => {
            wpDiffSqrt += Math.pow((wpScore[item]-wpMean),2);
        });
        let wpSD = Math.sqrt((wpDiffSqrt)/(Object.keys(wpScore).length - 1))
        //wpScoreZ
        Object.keys(wpScore).forEach(item => {
            wpScoreZ[item] = (wpScore[item] - wpMean)/wpSD;
            if(wpScoreZ[item] > 2 ) { wpScoreZ[item] = 2;}
            if(wpScoreZ[item] < -2) { wpScoreZ[item] = -2;}
        });
        //wpScoreZScal
        Object.keys(wpScore).forEach(item => {
            wpScoreZScal[item] = (wpScoreZScal[item]+2)*25;
        });


        //------COMPARISON------//


        ///PSEUDOCODE
        let positionScore;//implements

        let targetCog = (positionScore.COG.max + positionScore.COG.min)/2;
        let cogError = Math.abs(cogScoreFinal - targetCog);

        let wpTarget = { //IMPLEMENTS
            "WCEO": 0,
            "WCII": 0,
            "WIAM": 0,
            "WICH": 0,
            "WPAM": 0,
            "WPPM": 0,
        }
        

        let wpError = {
            "WCEO": 0,
            "WCII": 0,
            "WIAM": 0,
            "WICH": 0,
            "WPAM": 0,
            "WPPM": 0,
        }
        let wpMatch = {
            "WCEO": 0,
            "WCII": 0,
            "WIAM": 0,
            "WICH": 0,
            "WPAM": 0,
            "WPPM": 0,
        }
        Object.keys(wpTarget).forEach(item => {
            wpError[item] = Math.abs(wpTarget[item] - wpScoreZScal[item]);
            wpMatch[item]  = 100 - Math.abs(wpTarget[item] - wpScoreZScal[item]);
        });
        let wpSumError = 0;
        Object.keys(wpTarget).forEach(item => {
            wpSumError += wpError[item];
        });
        let wpAvgError = (ssSumError / Object.keys(wpError).length);
        let wpAvgMatch = 100 - wpAvgError;

        //per 
        let perTarget = { //IMPLEMENTS
            "agreeableness": 0,
            "competitiveness": 0,
            "conscientiousness": 0,
            "desireToLearn": 0,
            "emotionality": 0,
            "extraversion": 0,
            "mastery": 0,
            "otherReferencedGoals": 0,
            "selfEfficacy": 0,
            "worry": 0
        }
        let perError = { //IMPLEMENTS
            "agreeableness": 0,
            "competitiveness": 0,
            "conscientiousness": 0,
            "desireToLearn": 0,
            "emotionality": 0,
            "extraversion": 0,
            "mastery": 0,
            "otherReferencedGoals": 0,
            "selfEfficacy": 0,
            "worry": 0
        }
        Object.keys(perTarget).forEach(item => {
            perError[item] = Math.abs(perTarget[item] - perScoreZScal[item])
        });
        let perSumError = 0;
        Object.keys(perTarget).forEach(item => {
            perSumError += perError[item];
        });
        let perAvgError = (perSumError / Object.keys(perError).length);
        let perMatch = 100 - perAvgError;
        
        let ssTarget = { //IMPLEMENTS
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }

        let ssfTarget = { //IMPLEMENTS
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }

        let ssError = { 
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }
        let ssMatch = { 
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }

        let ssf = { 
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }
        let ssfError = { 
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }
        let ssfMatch = { 
            "CPN": 0,
            "LOM": 0,
            "PCS": 0,
            "PEW": 0,
            "PIS": 0,
            "PPM": 0,
            "SMC": 0,
        }

        Object.keys(ssTarget).forEach(item => {
            ssError[item] = Math.abs(ssTarget[item] - ssScoreZScal[item]);
            ssMatch[item] = 100 - Math.abs(ssTarget[item] - ssScoreZScal[item])
        });
        let ssSumError = 0;
        Object.keys(ssTarget).forEach(item => {
            ssSumError += ssError[item];
        });
        let ssAvgError = (ssSumError / Object.keys(ssError).length);

        Object.keys(ssf).forEach(item => {
            ssf[item] = ((perMatch + ssMatch[item])/2)
        });
        //compare ssf
        
        Object.keys(ssfTarget).forEach(item => {
            ssfError[item] = Math.abs(ssfTarget[item] - ssf[item]);
            ssfMatch[item] = 100 - Math.abs(ssfTarget[item] - ssf[item]);
        });

        let ssfSumError = 0;
        Object.keys(ssfTarget).forEach(item => {
            ssfSumError += ssfError[item];
        });
        let ssfAvgError = (ssSumError / Object.keys(ssError).length);
        let ssfAvgMatch = 100 - ssfAvgError;
        
    });
});

//#endregion

//#region EXPORTS
exports.users = functions.https.onRequest(usersAPI);
exports.jobs = functions.https.onRequest(jobsAPI);
exports.candidates = functions.https.onRequest(candidatesAPI);
//#endregion