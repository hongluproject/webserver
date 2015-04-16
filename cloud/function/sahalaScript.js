/**
 * Created by fugang on 15/1/17.
 */
var common = require('cloud/common.js');
var _ = AV._;

/*
    转换分享URL：包括动态、资讯
 */
AV.Cloud.define('convertShareURL', function(req, res){
    var bDevelopEnv = common.isSahalaDevEnv();
    function convertDynamicURL(skip, limit) {
        var skip = skip || 0;
        var limit = limit || 1000;
        var query = new AV.Query('DynamicNews');
        query.skip(skip);
        query.limit(limit);
        query.find().then(function(dynamics) {
            dynamics.forEach(function (dynamic) {
                var dynamicId = dynamic.id;
                if (bDevelopEnv) {
                    dynamic.set('share_url', 'http://apidev.imsahala.com/dynamic/'.concat(dynamicId));
                } else {
                    dynamic.set('share_url', 'http://api.imsahala.com/dynamic/'.concat(dynamicId));
                }
                dynamic.save();
            });

            if (dynamics&&dynamics.length==limit) {
                //没有转完，则继续转换
                convertDynamicURL(skip+limit);
            }
        });
    }
    function convertNewsURL(skip, limit) {
        var skip = skip || 0;
        var limit = limit || 1000;

        query = new AV.Query('News');
        query.contains('contents_url', 'https://');
        query.limit(limit);
        query.skip(skip);
        query.find().then(function(news){
            news.forEach(function(newItem){
                var newsId = newItem.id;
                if (bDevelopEnv) {
                    newItem.set('contents_url', 'http://apidev.imsahala.com/news/'.concat(newsId));
                } else {
                    newItem.set('contents_url', 'http://api.imsahala.com/news/'.concat(newsId));
                }

                newItem.save();
            });

            if (news&&news.length==limit) {
                //没有转完，则继续转换
                convertNewsURL(skip + limit);
            }
        });
    }

    function convertClanURL(skip, limit) {
        var skip = skip || 0;
        var limit = limit || 1000;

        query = new AV.Query('Clan');
        query.limit(limit);
        query.skip(skip);
        query.find().then(function(Clans){
            Clans.forEach(function(clanItem){
                var clanId = clanItem.id;
                if (bDevelopEnv) {
                    clanItem.set('shareUrl', 'http://apidev.imsahala.com/clan/'.concat(clanId));
                } else {
                    clanItem.set('shareUrl', 'http://api.imsahala.com/clan/'.concat(clanId));
                }

                clanItem.save();
            });

            if (Clans && Clans.length==limit) {
                //没有转完，则继续转换
                convertClanURL(skip+limit);
            }
        });
    }

    /*
    convertDynamicURL();
    convertNewsURL();
    */
    convertClanURL();

    res.success();
});

/** 更新部落信息，同步部落最大数，是否满员等信息
 *
 */
AV.Cloud.define('updateClanParam', function(req, res){
    //批量脚本：修改部落最大成员数
    var clanId = req.params.clanId;
    var queryClan = new AV.Query('Clan');
    queryClan.include('founder_id');
    if (clanId) {
        queryClan.equalTo('objectId', clanId);
    }
    queryClan.find().then(function(results){
        for (var i in results) {
            var userLevel = results[i].get('founder_id').get('level');
            var maxClanUsers = common.clanParam.getMaxClanUsers(userLevel);
            var currClanUsers = results[i].get('current_num');
            results[i].set('max_num', maxClanUsers);
            results[i].set('is_full', currClanUsers>=maxClanUsers);
            results[i].save();
        }
        res.success();
    });
});

AV.Cloud.define('updateClanForRC', function(req, res){
    var userId = req.params.userId;
    var updateType = req.params.updateType || 1;    //1:添加 2:删除
    var queryClanUser = new AV.Query('ClanUser');
    queryClanUser.include('clan_id');
    queryClanUser.limit(1000);
    if (userId) {
        queryClanUser.equalTo('user_id', AV.User.createWithoutData('_User',userId));
    }
    queryClanUser.find().then(function(results){
        results.forEach(function(clanUser){
            var userObj = clanUser.get('user_id');
            var clanObj = clanUser.get('clan_id');
            if (!userObj || !clanObj) {
                return;
            }
            //加入融云组群
            AV.Cloud.run('imAddToGroup',{
                userid:userObj.id,
                groupid:clanObj.id,
                groupname:clanObj.get('title')
            });
        });
        res.success(results);
    });
});

AV.Cloud.define('updateActivityForRC', function(req, res){
    var userId = req.params.userId;
    var query = new AV.Query('ActivityUser');
    query.include('activity_id');
    query.limit(1000);
    var activityObj = {};
    query.find().then(function(results){
        var activityId, activityName;
       results.forEach(function(userItem){
           var userId = userItem.get('user_id').id;
           var activity = userItem.get('activity_id');
           activityId = activity.id;
           activityName = activity.get('title');
           if (activityObj[activityId]) {
               var groupItem = activityObj[activityId];
               groupItem.userId.push(userId);
           } else {
               var groupItem = {
                   userId:[userId],
                   activityId:activityId,
                   activityName:activityName
               };
               activityObj[activityId] = groupItem;
           }
       })

        console.info('total activity : %d', _.keys(activityObj).length);

        var currNum = 0;
        var i = 1000;
        _.each(activityObj, function(item){
            _.delay(function(){
                console.info('current process is %d', ++currNum);
                //加入融云组群
                AV.Cloud.run('imAddToGroup',{
                    userid:item.userId,
                    groupid:item.activityId,
                    groupname:item.activityName
                });
            }, i);
            i += 500;
        });
    });
});




AV.Cloud.define('getInvitationCode', function(req, res){
    var option = req.params.option;
    var optionId = req.params.optionId;
    var userId =  req.params.userId;
    if (!option||!optionId||!userId) {
        res.error('亲亲参数输入错误了');
        return;
    }
    var rand8Number =   function s8(){
        var result = '';
        var data = [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
        for(var i=0;i<8;i++){ //产生20位就使i<20
            r=Math.floor(Math.random()*62); //16为数组里面数据的数量，目的是以此当下标取数组data里的值！
            result+=data[r]; //输出20次随机数的同时，让rrr加20次，就是20位的随机字符串了。
        }
        return result;
    }

    var randNumber =  rand8Number();
    var InvitationCode = AV.Object.extend("InvitationCode");
    var invitationCode = new InvitationCode();
    invitationCode.set("userId", AV.Object.createWithoutData("_User", userId, false));
    invitationCode.set("invitationCode", randNumber);
   if(option == 1){
       invitationCode.set("clanId", AV.Object.createWithoutData("Clan", optionId, false));
       invitationCode.set("option", 1);
       invitationCode.save(null, {
           success: function () {
               res.success({
                   invitationCode:randNumber
               });
           },
           error: function () {
               res.error('亲亲又报错了');
           }
       });
   }else if(option == 2){
       invitationCode.set("activityId", AV.Object.createWithoutData("Activity", optionId, false));
       invitationCode.set("option", 2);
       invitationCode.save(null, {
           success: function () {
               res.success({
                   invitationCode:randNumber
               });
           },
           error: function () {
               res.error('亲亲又报错了');
           }
       });
   }
});


AV.Cloud.define('validateInvitationCode', function(req, res){
    var invitationCode = req.params.invitationCode;
    var InvitationCode = AV.Object.extend("InvitationCode");
    var query = new AV.Query(InvitationCode);
    query.equalTo("invitationCode",invitationCode);

    //一周内
    var today=new Date();
    var t=today.getTime()-1000*60*60*24*7;
    var searchDate=new Date(t);
    query.greaterThan('createdAt',searchDate);
    query.descending("createdAt");
    query.first({
        success: function(object) {
            if(object){
                res.success({
                    invitationCodeStatus:true
                });
            }else{
                res.success({
                    invitationCodeStatus:false
                });
            }
        },
        error: function(error) {
            res.success({
                invitationCodeStatus:false
            });
        }
    });

});




AV.Cloud.define('getInvitationInfo', function(req, res){
    var invitationCode = req.params.invitationCode;
    var InvitationCode = AV.Object.extend("InvitationCode");
    var query = new AV.Query(InvitationCode);
    query.equalTo("invitationCode",invitationCode);
    //一周内
    var today=new Date();
    var t=today.getTime()-1000*60*60*24*7;
    var searchDate=new Date(t);
    query.greaterThan('createdAt',searchDate);
    query.descending("createdAt");
    query.first({
        success: function(object) {
            if(object){
                var optionId = null;
                if(object.get('option') == 1){
                    optionId =  object.get('clanId').id;
                }else{
                    optionId =  object.get('activityId').id;
                }
                res.success({
                     "option":object.get('option'),
                     "optionId":optionId
                });
            }else{
                res.error('error');
            }
        },
        error: function(error) {
            res.error('error');
        }
    });



});

AV.Cloud.define('queryPingXX', function(req, res){
    var chargeId = req.params.chargeId;
    var refundId = req.params.refundId;
    var queryType = req.params.queryType || 'charge';
    var pingpp = require('pingpp');

    if (queryType == 'charge') {
        pingpp(common.pingxxAppKey).charges.retrieve(chargeId).then(function(charge){
            res.success(charge);
        });
    } else if (queryType == 'refund') {
        pingpp(common.pingxxAppKey).charges.retrieveRefund(chargeId, refundId).then(function(charge){
            res.success(charge);
        });
    } else {
        res.error();
    }
});

/*

 */
AV.Cloud.define('joinMountaineerActivity', function(req, res){
    AV.Cloud.httpRequest({
        method: 'GET',
        url: 'http://sport.hoopeng.cn/api/sport/userinfo'
    }).then(function(response){
        console.info('joinMountaineerActivity http status code %d ', response.status);
        if (response.status != 200) {
            console.error('joinMountaineerActivity error:%d', response.status);
            return;
        }

        var userVal = JSON.parse(response.text);
        if (userVal) {
            var userObj = {};
            _.each(userVal, function (userItem) {
                userObj[userItem.phone] = userItem.username;
            });
            var importUsers = _.keys(userObj);

            //拿到所有用户信息
            var query = new AV.Query('_User');
            query.containedIn('username', importUsers);
            query.find().then(function(users){
                var userObjs = [];
                var userObjMap = {};
                _.each(users, function(userItem){
                    userObjs.push(userItem._toPointer());

                    var phone = userItem.get('username');
                    userObjMap[userItem.id] = {
                        phone:phone,
                        realname:userObj[phone]
                    };
                });

                var queryActivity = new AV.Query('ActivityUser');
                queryActivity.containedIn('user_id', userObjs);
                queryActivity.equalTo('activity_id', AV.Object.createWithoutData('Activity', common.getMountaineerClubActivityId()));
                queryActivity.find().then(function(activityUsers){
                    _.each(activityUsers, function(item){
                        var userObjId = item.get('user_id').id;
                        if (userObjMap[userObjId]) {
                            delete userObjMap[userObjId];
                        }
                    });

                    console.info('unjoin activity user:', userObjMap);
                    for (var userId in userObjMap) {
                        AV.Cloud.run('signUpActivity', {
                            userId:userId,
                            activityId:common.getMountaineerClubActivityId(),
                            skipDeadTime:true,
                            userGroup:[
                                {
                                    realName:userObjMap[userId].realname,
                                    phone:userObjMap[userId].phone
                                }
                            ]
                        });
                    }
                });

            });
        }
    });
});

/*
    将登协的用户注册到撒哈拉平台
 */
AV.Cloud.define('importMountaineer', function(req, res){
    AV.Cloud.httpRequest({
        method: 'GET',
        url: 'http://sport.hoopeng.cn/api/sport/userinfo'
    }).then(function(response){
        console.info('importMountaineer http status code %d ', response.status);
        if (response.status == 200) {
            var userVal = JSON.parse(response.text);
            if (userVal) {
                var userObj = {};
                _.each(userVal, function(userItem){
                    userObj[userItem.phone] = userItem.username;
                });
                var importUsers = _.keys(userObj);

                //找到尚未注册的用户
                var query = new AV.Query('_User');
                query.containedIn('username', importUsers);
                query.find().then(function(users){

                    /*
                    _.each(users, function(userItem){
                        var username = userItem.get('username');
                        var password = username.substr(-6);
                        AV.User.logIn(username,password).then(function(userItem){
                            var nickname = '行者'.concat(userItem.get('invite_id'));
                            userItem.set('mobilePhoneNumber', userItem.get('username'));
                            userItem.set('nickname', nickname);
                            userItem.save().then(function(user){
                                console.info('save user %s ok', nickname);
                            }, function(err){
                                console.error('save user %s fail', nickname, err);
                            });
                            console.info('update user mobilePhoneNumber %s', nickname);
                        }, function(err){
                            console.error(err);
                        })
                    });
                    //return;
                    */

                    var registerUsers = [];
                    _.each(users, function(userItem){
                        console.info(userItem.get('username'));
                       registerUsers.push(userItem.get('username'));
                    });

                    //比较两个数组，找出尚未注册的用户
                    var unregisterUsers = _.difference(importUsers, registerUsers);
                    console.info('unregister users ', unregisterUsers);
                    _.each(unregisterUsers, function(userPhone){
                        var userName = userPhone;
                        var realName = userObj[userPhone];
                        var password = userName.substr(-6);
                        console.info('user %s realname %s password %s begin register', userName, realName, password);
                        AV.User.signUp(userName,password,{
                            mobilePhoneNumber:userName
                        }).then(function(user){
                            var username = user.get('username');
                            var password = username.substr(-6);
                            console.info('user %s password %s beigin login', username, password);
                            return AV.User.logIn(userName, password);
                        }).then(function(user){
                            //注册，设置nickname
                            var invitedId = user.get('invite_id');
                            user.set('nickname', '行者'.concat(invitedId));
                            console.info('set current user nickname %s', user.get('nickname'));
                            user.save();
                        }, function(err){
                            console.error('register mountaineer club user fail:', err);
                        });
                    });
                });
            }
        }
    });
});
