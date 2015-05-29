/**
 * Created by fugang on 15/1/17.
 */
var common = require('cloud/common.js');
var _ = AV._;
var Promise = AV.Promise;

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
    queryClan.limit(1000);
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
    清除登协活动所有报名信息
    函数名：
        clearMountaineerActivity
    参数:
        无
    返回：
        success or fail
 */
AV.Cloud.define('clearMountaineerActivity', function(req, res){

    var destroyAll = function() {
        var query = new AV.Query('ActivityUser');
        query.equalTo('activity_id', AV.Object.createWithoutData('Activity', common.getMountaineerClubActivityId()));
        query.limit(500);
        query.find().then(function(results){
            if (_.isEmpty(results)) {
                return;
            }
            if (results.length < 500) {
                AV.Object.destroyAll(results);
            } else {
                AV.Object.destroyAll(results).then(function(){
                   destroyAll();
                });
            }
        });
    }

    destroyAll();
});
/*
    将登协用户加入登协活动
    1、通过用户数据接口，拿到所有用户数据。
    2、找到已经注册过的用户，然后再查找哪些用户已经加入过活动，得到尚未加入活动的用户。
    3、执行加入活动的操作。
    注：该函数可重复执行，不会产生冗余数据。

    函数名：
        joinMountaineerActivity
    参数：
        无
    返回：
        success or fail

 */
AV.Cloud.define('joinMountaineerActivity', function(req, res){
    AV.Cloud.httpRequest({
        method: 'GET',
        url: 'http://sport.hoopeng.cn/api/sport/userinfo'
    }).then(function(response){
        console.info('joinMountaineerActivity http status code %d ', response.status);
        if (response.status != 200) {
            console.error('joinMountaineerActivity error:%d', response.status);
            res.error('joinMountaineerActivity error:'+response.status);
            return;
        }

        var unjoinUsers;
        var userVal = JSON.parse(response.text);
        if (userVal) {
            var userObj = {}, userObjMap = {};
            _.each(userVal, function (userItem) {
                userObj[userItem.phone] = userItem.username;
            });
            var importUsers = _.keys(userObj);

            console.info('total import user count %d', importUsers&&importUsers.length);

            //拿到所有用户列表
            var registerUserIds = [];
            var userArray = [];
            for (var i=0;1;i++) {
                var findUsers = importUsers.slice(i * 1000, (i + 1) * 1000);
                if (!_.isEmpty(findUsers)) {
                    userArray.push(findUsers);
                }

                console.info('findUsers length is %d', findUsers.length);

                if (!findUsers || findUsers.length<1000) {
                    break;
                }
            }
            var promise1 = Promise.as();
            promise1.then(function(){
                var promise2 = Promise.as();
                _.each(userArray, function(item){
                    promise2 = promise2.then(function(){
                        var query = new AV.Query('User');
                        query.containedIn('username', item);
                        query.limit(1000);
                        return query.find().then(function(users){
                            _.each(users, function(user){
                                registerUserIds.push(user.id);
                                var phone = user.get('username');
                                userObjMap[user.id] = {
                                    phone:phone,
                                    realname:userObj[phone]
                                }
                            });

                            return Promise.as();
                        });
                    });
                });

                return promise2;
            }).then(function(){
                //找到所有已经加入活动的用户
                var query = new AV.Query('Activity');
                query.equalTo('objectId', common.getMountaineerClubActivityId());
                return query.first().then(function(activity){
                    var joinUsers = activity.get('joinUsers');
                    return Promise.as(joinUsers);
                });
            }).then(function(joinUsers){
                console.info('joiunUsers count %d', joinUsers&&joinUsers.length);
                //找到那些还未加入登协活动的用户，然后开始执行加入活动
                unjoinUsers = _.difference(registerUserIds, joinUsers);
                unjoinUsers = _.unique(unjoinUsers);
                console.info('total unjoin users is %d', unjoinUsers.length);
                var promise3 = Promise.as();
                var promise4 = Promise.as();
                var ActivityUser = AV.Object.extend('ActivityUser');
                var leftCount = unjoinUsers.length;
                return promise4.then(function(){
                    _.each(unjoinUsers, function(userId){
                        promise3 = promise3.then(function(){
                            var activityUser = new ActivityUser();
                            activityUser.set('phone', userObjMap[userId].phone);
                            activityUser.set('real_name', userObjMap[userId].realname);
                            activityUser.set('user_id', AV.User.createWithoutData('User', userId));
                            activityUser.set('activity_id', AV.Object.createWithoutData('Activity',common.getMountaineerClubActivityId()));
                            console.info('%d user left,userId %s, phone %s, realname %s', --leftCount, userId, userObjMap[userId].phone, userObjMap[userId].realname);
                            return activityUser.save();
                            /*
                             return AV.Cloud.run('signUpActivity', {
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
                             */
                        });
                    });

                    return promise3;
                });
            }).then(function(){
                //将用户写入 joinUsers
                var Activity = AV.Object.extend('Activity');
                var activity = new Activity();
                activity.id = common.getMountaineerClubActivityId();
                activity.set('hasSignupUsers', unjoinUsers);
                activity.set('joinUsers', unjoinUsers);
                activity.set('current_num', unjoinUsers.length);
                return activity.save();
            }).then(function(){
                res.success('ok');
            });
        }

    });
});

/*
    将登协的用户注册到撒哈拉平台
    1、访问用户数据接口，拿到所有用户列表
    2、在用户表中找到尚未注册的用户，开始执行注册（密码为手机号后6位）
    3、注册完成后，设置用户的nickname
    注：该函数可重复执行，不会产生冗余数据
 */
AV.Cloud.define('importMountaineer', function(req, res){
    var skip = req.params.skip || 0;
    var limit = req.params.limit || 1000;

    AV.Cloud.httpRequest({
        method: 'GET',
        url: 'http://sport.hoopeng.cn/api/sport/userinfo'
    }).then(function(response){
        console.info('importMountaineer http status code %d ', response.status);
        if (response.status == 200) {
            var userVal = JSON.parse(response.text);
            if (userVal) {
                var userObj = {};
                var illegalPhones = [];
                _.each(userVal, function(userItem){
                    if (userItem.phone.length == 11) {
                        userObj[userItem.phone] = userItem.username;
                    }
                });
                var importUsers = _.unique(_.keys(userObj));
                var unregistUsers = [];
                var registerUsers = [];

                var userArray = [];
                for (var i=0;1;i++) {
                    var findUsers = importUsers.slice(i * 1000, (i + 1) * 1000);
                    if (!_.isEmpty(findUsers)) {
                        userArray.push(findUsers);
                    }

                    console.info('findUsers length is %d', findUsers.length);

                    if (!findUsers || findUsers.length<1000) {
                        break;
                    }
                }

                //先找出所有尚未注册的手机号
                var promise = Promise.as();
                promise.then(function(){
                    var promise2 = Promise.as();
                    _.each(userArray, function(findUsers){
                        promise2 = promise2.then(function(){
                            var query = new AV.Query('_User');
                            query.containedIn('username', findUsers);
                            query.limit(1000);
                            return query.find().then(function(users){
                                _.each(users, function(userItem){
                                    registerUsers.push(userItem.get('username'));
                                });

                                return Promise.as();
                            });
                        });
                    });

                    return promise2;
                }).then(function(){
                    //比较两个数组，找出尚未注册的用户
                    unregistUsers = _.difference(importUsers, registerUsers);
                    unregistUsers = _.unique(unregistUsers);
                    console.info('total unregister user count is %d', unregistUsers&&unregistUsers.length);

                    //开始逐个注册
                    promise = Promise.as();
                    var leftCount = unregistUsers && unregistUsers.length;
                    _.each(unregistUsers, function(userPhone){
                        var userName = userPhone;
                        var realName = userObj[userPhone];
                        var password = userName.substr(-6);
                        console.info('%d user left,user %s realname %s password %s begin register', --leftCount, userName, realName, password);
                        promise = promise.then(function(){
                            return AV.User.signUp(userName,password,{
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
                                user.set('tags', [common.getCityTag()]); //设置城市定向标签
                                console.info('set current user nickname %s', user.get('nickname'));
                                return user.save();
                            }, function(err){
                                console.error('register mountaineer club user fail:', err);
                                return Promise.as();
                            });
                        });
                    });
                });
            }
        }
    });
});

/*  为登协队伍创建部落，并把下面的成员加入到该部落中

 */
AV.Cloud.define('createClanForTeam', function(req, res){
    AV.Cloud.httpRequest({
        method: 'GET',
        url: 'http://sport.hoopeng.cn/api/sport/userinfo'
    }).then(function(response) {
        console.info('importMountaineer http status code %d ', response.status);
        if (response.status == 200) {
            var userVal = JSON.parse(response.text);
            if (userVal) {
                var teams = _.values(userVal);
            }
        }
    });
});

/**
 * 注册账号
 * 参数：
 *      username:string 账户名
 *      password:string 密码
 */
AV.Cloud.define('signUpUser', function(req, res){
    var username = req.params.username;
    var password = req.params.password;

    AV.User.signUp(username,password,{
        mobilePhoneNumber:username,
        nickname:'小撒'
    }).then(function(user) {
        console.dir(user);
        res.success(user._toFullJSON());
    }, function(err){
        console.error('注册失败:', err);
        res.error(err);
    });

});

/** 关注官方账号
 *
 */
AV.Cloud.define('followAssistants', function(req, res){
    var sahalaObjs = [];
    var assistants = common.getSahalaAssistants();

    _.each(assistants, function(user){
        sahalaObjs.push(AV.User.createWithoutData('_User', user));
    });

    var allUserIds = [];
    var allUserObjs = [];
    var query = new AV.Query('_User');
    query.notContainedIn('objectId', assistants);
    query.limit(1000);
    query.find().then(function(users){
        console.info('total user count is %d', users.length);
        _.each(users, function(user){
            allUserObjs.push(AV.User.createWithoutData('_User', user.id));
            allUserIds.push(user.id);
        });

        var query = new AV.Query('_Followee');
        query.containedIn('user', allUserObjs);
        query.containedIn('followee', sahalaObjs);
        query.limit(1000);
        query.find().then(function(results){
            console.info('followee user count is %d', results.length);
            var followees = [];
            _.each(results, function(user){
                followees.push(user.get('user').id);
            });

            var unfollowees = _.difference(allUserIds, followees);
            console.info('unfollowees count %d, content %s', unfollowees.length, unfollowees);
            _.each(unfollowees, function(userId){
                if (process && process.domain)
                    process.domain._currentUser = AV.User.createWithoutData('_User', userId);
                _.each(assistants, function(assistantUserId){
                    console.info('user %s follow sahala assistant %s', userId, assistantUserId);
                    AV.User.current().follow(assistantUserId);
                })
            });

        });
    });
});

