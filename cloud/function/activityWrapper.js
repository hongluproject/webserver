/**
 * Created by fugang on 14/12/30.
 */
var common = require('cloud/common');
var querystring = require('querystring');
var pingpp = require('pingpp');
var _ = require('underscore')._;
var Promise = AV.Promise;

/** 加入活动，可批量提交
 * @params:
 *  activityId: String 活动ID
 *  activityUsers: Array 参加活动的用户信息
 */
AV.Cloud.define('joinActivity', function(req, res) {
    var activityId = req.params.activityId;
    var activityUsers = req.params.activityUsers;
    var userCount = activityUsers.length;
    if (userCount <= 0 || !activityId) {
        res.error('请传入数据！');
        return;
    }

    console.info('submitActivityUser params activityId:%s activityUsers:', activityId, activityUsers);

    //查询活动是否已经超过上限
    var queryActivity = new AV.Query('Activity');
    queryActivity.get(activityId).then(function(activityResult) {
        if (!activityResult) {
            res.error('没有找到对应的活动:'+activityId);
            return;
        }

        //判断报名人数是否已经超过上限
        var currNum = activityResult.get('current_num');
        var maxNum = activityResult.get('max_num');
        if (maxNum && currNum >= maxNum) {
            res.error('报名人数已经超过上限！');
            return;
        }

        //判断报名截止时间已过
        var currDate = new Date();
        var deadDate = activityResult.get('dead_time');
        if (currDate.getTime() > deadDate.getTime()) {
            res.error('报名时间已过！');
            return;
        }

        var saveObj = {
            sex:1,
            real_name:1,
            phone:1,
            user_info:1,
            idcard:1,
            passport_card:1,
            two_way_permit:1,
            mpt:1
        };
        //开始保存提交的报名信息
        for (var i=0; i<userCount; i++) {
            var currActivityUser = activityUsers[i];

            //create return activityUser
            var ActivityUserClass = common.extendClass('ActivityUser');
            var returnActivityUser = new ActivityUserClass();
            returnActivityUser.set('user_id', AV.Object.createWithoutData('_User', currActivityUser.user_id.objectId));
            returnActivityUser.set('activity_id', AV.Object.createWithoutData('Activity', currActivityUser.activity_id.objectId));

            for (var k in currActivityUser) {
                if (saveObj[k] == 1) {
                    returnActivityUser.set(k, currActivityUser[k]);
                }
            }
            returnActivityUser.save();
        }

       // common.postRCMessage(likeUser.id,postUser.id,'点赞了你的动态','newLike',dynamic.id);

        res.success();
    }, function(error) {
        console.error('joinActivity error:', error);
        res.error('加入活动失败，错误码:'+error.code);
    });
});

/** 取消加入活动
 * @params {
 *  userId: String 用户ID
 *  activityId: String 活动ID
 * }
 */
AV.Cloud.define('quitActivity', function(req, res) {
    var userId = req.params.userId || (req.user && req.user.id);
    var activityId = req.params.activityId;
    if (!userId || !activityId) {
        res.error('请输入参数！');
        return;
    }

    console.info('quitActivity param, userId:%s activityId:%s', userId, activityId);

    var queryActivity = new AV.Query('ActivityUser');
    queryActivity.equalTo('user_id', AV.User.createWithoutData('_User', userId));
    queryActivity.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
    queryActivity.find().then(function(activityUserResults) {
        if (!activityUserResults || activityUserResults.length<=0) {
            res.error('没有找到需要删除的活动信息！');
            return;
        }

        //删除这些数据
        AV.Object.destroyAll(activityUserResults);

        res.success();
    }, function(error) {
        console.error('quitActivity failed:', error);
        res.error('取消活动加入失败!');
    });
});






/** 添加报名 函数名：signUpActivity
 * @params {
 *  userId: objectId 用户ID
 *  activityId : objectId 用户ID
 *  teamId: objectId 团队ID，暂不考虑团队报名，不用传
 *  skipDeadTime: bool 是否跳过报名时间限制
 *  userGroup:[ {"realName":"\u96ea\u677e",
 *              "idcard":"321111198306182318",
 *              "phone":"15955159604"，
 *              “twoWayPermit”, "13123123",
 *              "passportCard", "123123123"
 *              },
*               {"realName":"\u96f7\u4e91\u6d4b\u8bd5",
*               "idcard":"321111198306182318",
*               "phone":"15955159603",
**              “twoWayPermit”, "13123123"},
                }
 *          ]
 *  payMode:Integer 在线支付方式(支付宝。微信)  1：支付宝 2：微信
 *  accountStatus:Interger 订单状态：（1, 待支付  默认值  2, 已支付 3, 申请退款  4，退款完成  5，退出活动）
 *  signupType:报名方式  0:在线报名  1：线下报名
 *}
 * @return  {
 *  orderNo:131231234
 * }
 *  处理流程：
 *  1、先根据userId activityId查询statementAccount表，判断用户是否已经存在订单，
 *          根据accountStatus，为1或者2，则认为不用创建订单
 *  2、将用户传入的联系方式信息加入ActivitySignUpUser表
 *  3、查询活动对应的订单，将订单信息写入 statementAccount表
 *  4、线下活动报名特殊对待：
 *      a)跳过时间和人数限制，只要未曾报名，均可加入报名列表
 *      b)活动需要对最大人数做自动增加处理，程序动态控制线下报名的最大人数，保障当前人数不要超过最大人数
 *  */
AV.Cloud.define('signUpActivity', function(req, res) {
    console.info('signUpActivity params:', req.params);

    //取得用户传入的参数
    var userId = req.params.userId;
    var teamId = req.params.teamId;
    var activityId = req.params.activityId;
    var userGroup = req.params.userGroup;
    var skipDeadTime = req.params.skipDeadTime || false;
    if (typeof userGroup == 'string') {
        userGroup = JSON.parse(userGroup);
    }
    if (!userId || !activityId) {
        res.error('请输入参数！');
        return Promise.as();
    }
    var payMode = req.params.payMode||1;
    var accountStatus =  req.params.accountStatus||1;
    var signupType = req.params.signupType || 0;
    var bAddToActivityUser = false;
    var orderNo;
    var activity;
    var signupUserObj;

    var query = new AV.Query('Activity');
    return query.get(activityId).then(function(result){
        if (!result) {
            res.error('对应的活动不存在！');
            return Promise.error();
        }

        activity = result;
        if (common.isOfflineSignup(signupType)) {
            //判断是否已经在报名列表中
            var joinUsers = activity.get('joinUsers');
            if (joinUsers && _.contains(joinUsers,userId)) {
                console.error('已经报名！');
                res.error('该用户已经加入了活动了哦!');
                return Promise.error();
            }

            var ActivityUser = common.extendClass('ActivityUser');
            var activityUser = new ActivityUser();
            activityUser.set('signupType', 1);  //线下报名标识
            activityUser.set('user_id', AV.Object.createWithoutData('_User', userId));
            activityUser.set('activity_id', AV.Object.createWithoutData('Activity', activityId));
            activityUser.save().then(function(result){
                res.success();
            }).catch(function(err){
                res.error('报名失败,错误码:', err&&err.code);
            });
            console.info('线下报名，直接跳过!');
            return Promise.error();
        }

        var bRemoved = activity.get('removed') || false;
        if (bRemoved) {
            console.error('该活动已取消！');
            res.error('该活动已取消！');
            return Promise.error();
        }

        //判断报名截止时间已过
        if (!skipDeadTime) {
            var currDate = new Date();
            var deadDate = activity.get('dead_time');
            if (currDate.getTime() > deadDate.getTime()) {
                console.error('报名时间已过！');
                res.error('该活动报名时间已过！');
                return Promise.error();
            }
        }

        //判断报名人数是否已经超过上限
        var currNum = activity.get('current_num');
        var maxNum = activity.get('max_num');
        if (maxNum && currNum >= maxNum) {
            console.error('报名人数已满！');
            res.error('该活动报名人数已满！');
            return Promise.error();
        }

        //判断是否已经在报名列表中
        var joinUsers = activity.get('joinUsers');
        if (joinUsers && _.indexOf(joinUsers,userId)>=0) {
            console.error('已经报名！');
            res.error('该用户已经加入了活动了哦!');
            return Promise.error();
        }

        //判断活动类型，如果不是线上支付，可以直接加入 ActivityUser 表
        var payType = activity.get('pay_type');
        if (!common.isOnlinePay(payType)) {
            bAddToActivityUser = true;
            accountStatus = 2;
        }

        //进入生成订单流程
        var userItem = userGroup[0];
        var ActivitySignUpUser = common.extendClass("ActivitySignUpUser");
        var activitySignUpUser = new ActivitySignUpUser();
        if (userItem.sex) {
            activitySignUpUser.set('sex', userItem.sex);
        }
        if (userItem.realName) {
            activitySignUpUser.set("realName", userItem.realName);
        }
        if (userItem.phone) {
            activitySignUpUser.set("phone", userItem.phone);
        }
        if (userItem.idcard) {
            activitySignUpUser.set('idcard', userItem.idcard);
        }
        if (userItem.twoWayPermit) {
            activitySignUpUser.set('twoWayPermit', userItem.twoWayPermit);
        }
        if (userItem.passportCard) {
            activitySignUpUser.set('passportCard', userItem.passportCard);
        }
        if (userItem.mtp) {
            activitySignUpUser.set('mtp', userItem.mtp);
        }
        activitySignUpUser.set('userId', AV.Object.createWithoutData('_User', userId));
        activitySignUpUser.set('activityId', AV.Object.createWithoutData('Activity', activityId));
        return activitySignUpUser.save();
    }).then(function(result){
        if (!result) {
            console.error('user %s 加入 %s 活动，登记报名信息失败！', req.user&&req.user.get('nickname'), activity.get('title'));
            res.error('登记报名信息失败!');
            return Promise.error();
        }
        signupUserObj = result;

        //获取时间戳
        var timestamp = (Date.parse(new Date()))/1000;
        var rand4Number =   function s4(){
            var data = [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
            /*
            for(var i=0;i<4;i++){ //产生20位就使i<20
                r=Math.floor(Math.random()*62); //16为数组里面数据的数量，目的是以此当下标取数组data里的值！
                result+=data[r]; //输出20次随机数的同时，让rrr加20次，就是20位的随机字符串了。
            }
            */

            return _.sample(data, 4).join('');
        }

        var StatementAccount = common.extendClass("StatementAccount");
        var statementAccount = new StatementAccount();
        statementAccount.set('payMode', payMode);
        statementAccount.set('bookNumber', timestamp+rand4Number());
        statementAccount.set('userId',  AV.Object.createWithoutData('_User', userId));
        statementAccount.set('activityId',  AV.Object.createWithoutData('Activity', activityId));
        statementAccount.set('accountStatus', accountStatus);
        statementAccount.set('signupId', result._toPointer());
        return statementAccount.save();
    }).then(function(result){
        if (!result) {
            console.error('user %s 加入 %s 活动，生成订单失败！', req.user&&req.user.get('nickname'), activity.get('title'));
            res.error('生成订单失败！');
            return Promise.error();
        }
        orderNo = result.get('bookNumber');
        if (bAddToActivityUser) {   //直接加入到ActivityUser表中
            var userItem = userGroup[0];
            var ActivityUser = common.extendClass('ActivityUser');
            var activityUser = new ActivityUser();
            if (userItem.sex) {
                activityUser.set('sex', userItem.sex);
            }
            if (userItem.realName) {
                activityUser.set('real_name', userItem.realName);
            }
            if (userItem.phone) {
                activityUser.set('phone', userItem.phone);
            }
            if (userItem.idcard) {
                activityUser.set('idcard', userItem.idcard);
            }
            if (userItem.twoWayPermit) {
                activityUser.set('two_way_permit', userItem.twoWayPermit);
            }
            if (userItem.passportCard) {
                activityUser.set('passport_card', userItem.passportCard);
            }
            if (userItem.mtp) {
                activityUser.set('mtp', userItem.mtp);
            }
            activityUser.set('user_id', AV.Object.createWithoutData('_User', userId));
            activityUser.set('activity_id', AV.Object.createWithoutData('Activity', activityId));
            activityUser.set('order_id', result._toPointer());
            return activityUser.save();
        } else {
            return AV.Promise.as();
        }
    }).then(function(result){
        res.success({orderNo:orderNo});

        return Promise.as();
    }, function(err){
        if (err) {
            console.error('user %s 加入 %s 活动，报名失败:', req.user&&req.user.get('nickname'), activity.get('title'), err);
            res.error('生成订单失败,错误码:'+err.code);
        }

        return Promise.as();
    });
});

/** 获取活动详情 函数名：getActivityDetail
 *  @params {
 *    activityId: objectId 活动ID
 *  }
 *  @return {
 *      activity: Activity Object
 *      extra: {
 *          signupUsers: array 已报名用户列表
 *          hasSignup: bool 当前用户是否已经报名
 *          accountStatus:Integer 当前订单状态
 *          bookNuber:string 订单编号
 *          bMountaineerClub:bool 登协定制活动
 *          levelUrl:登协通关URL
 *      }
 *  }
 */
AV.Cloud.define('getActivityDetail', function(req, res){
    var userId = req.params.userId || (req.user&&req.user.id);
    if (!userId) {
        res.error('请登录账号！');
        return;
    }
    var activityId = req.params.activityId;
    if (!activityId) {
        return res.error('请传入活动ID！');
    }
    var currActivity;
    var founderUserId;
    var payType = 1;
    var bMountaineerClub = (activityId==common.getMountaineerClubActivityId());
    var extraData = {
        bMountaineerClub: bMountaineerClub,
        levelUrl:bMountaineerClub?'http://sport.hoopeng.cn/api/sport/pathinfo':''
    };

    var queryActivity = new AV.Query('Activity');
    queryActivity.select('-joinUsers', '-hasSignupUsers');
    queryActivity.include('user_id');
    queryActivity.equalTo('objectId', activityId);
    queryActivity.first().then(function(activity){
        if (!activity) {
            res.error('没有找到对应的活动！');
            return;
        }
        currActivity = activity;
        if (activity.get('mountain')) {
            extraData.bMountaineerClub = true;
            extraData.levelUrl = 'http://sport.hoopeng.cn/api/sport/pathinfo';
        }

        payType = activity.get('pay_type');
        var userObj = activity.get('user_id');
        activity.set('user_info', {
            nickname:userObj.get('nickname'),
            icon:userObj.get('icon')||''
        });
        //简化user_id的返回内容
        var _ = AV._;
        //保留的user keys
        var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "actual_position"];
        activity.set('user_id', _.pick(userObj._toFullJSON(), pickUserKeys));

        var activityFounder = activity.get('user_id');
        founderUserId = activityFounder.id;
        if (userId == activityFounder.id) { //如果是活动发起者，就不用做后续查询了
            query = new AV.Query('ActivityUser');
            query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
            query.notEqualTo('user_id', AV.User.createWithoutData('_User', userId));
            query.descending('createdAt');
            query.limit(10);
            query.include('user_id');
            return query.find();
        } else {
            //查询ActivityUser，主要目的：
            // 1、查自己是否已经报名
            // 2、查该活动最近的报名人
            var promises = [];

            query = new AV.Query('ActivityUser');
            query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
            query.notEqualTo('user_id', AV.User.createWithoutData('_User', userId));
            query.descending('createdAt');
            query.limit(10);
            query.include('user_id', 'order_id');
            promises.push(query.find());

            var query = new AV.Query('ActivityUser');
            query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
            query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
            query.include('user_id', 'order_id');
            promises.push(query.first());

            return Promise.when(promises);
        }
    }).then(function(results, myActivityUser){
        var bHasSignup = false;
        if (results) {   //设置已经报名状态
            var signupUsers = [];
            results.forEach(function(item){
                var user = item.get('user_id');
                if (user) {
                    signupUsers.push({
                        nickname:user.get('nickname')||'',
                        icon:user.get('icon')||''
                    });
                }
            });

            extraData.signupUsers = signupUsers;
        }

        if (myActivityUser) {
            bHasSignup = true;
            var orderObj = myActivityUser.get('order_id');
            if (orderObj) {
                extraData.accountStatus = orderObj.get('accountStatus')||1;
                extraData.bookNumber = orderObj.get('bookNumber')||'';
            }
            if (_.isEmpty(extraData.signupUsers)) {
                var user = myActivityUser.get('user_id');
                extraData.signupUsers = [{
                    nickname:user.get('nickname')||'',
                    icon:user.get('icon')||''
                }];
            }
        }

        extraData.hasSignup = bHasSignup;

        if (!bHasSignup) {
            //若用户还未加入活动，则查询订单状态
            var query = new AV.Query('StatementAccount');
            query.select('accountStatus', 'bookNumber');
            query.equalTo('userId', AV.User.createWithoutData('_User', userId));
            query.equalTo('activityId', AV.Object.createWithoutData('Activity', activityId));
            query.descending('createdAt');
            return query.first();
        } else {
            return AV.Promise.as();
        }
    }).then(function(result){
        if (result) {   //返回订单状态
            extraData.accountStatus = result.get('accountStatus');
            extraData.bookNumber = result.get('bookNumber');
        }

        extraData.tagNames = common.tagNameFromId(currActivity.get('tags'));
        res.success({
            activity:currActivity,
            extra:extraData
        });
    }, function(err){
        console.error('获取活动失败:', err);
        res.error('获取活动失败，错误码:'+err.code);
    });
});

/**
    获取活动详情
    函数名：getActivityDetail2
    @params {
      activityId: objectId 活动ID
    }
    @return {
        activity: Activity Object
        extra: {
            signupUsers: array 已报名用户列表
            hasSignup: bool 当前用户是否已经报名
            accountStatus:Integer 当前订单状态
            bookNuber:string 订单编号
            bMountaineerClub:bool 登协定制活动
            levelUrl:登协通关URL
            tagNames:array 活动tagID对应名称
        }
    }
 */
AV.Cloud.define('getActivityDetail2', function(req, res){
    var userId = req.params.userId || (req.user&&req.user.id);
    if (!userId) {
        res.error('请登录账号！');
        return;
    }
    var activityId = req.params.activityId;
    if (!activityId) {
        return res.error('请传入活动ID！');
    }
    var currActivity;
    var founderUserId;
    var payType = 1;
    var bMountaineerClub = (activityId==common.getMountaineerClubActivityId());
    var extraData = {
        bMountaineerClub: bMountaineerClub,
        levelUrl:bMountaineerClub?'http://sport.hoopeng.cn/api/sport/pathinfo':''
    };

    var queryActivity = new AV.Query('Activity');
    queryActivity.select('-joinUsers', '-hasSignupUsers');
    queryActivity.include('user_id');
    queryActivity.equalTo('objectId', activityId);
    queryActivity.first().then(function(activity){
        if (!activity) {
            res.error('没有找到对应的活动！');
            return;
        }
        currActivity = activity;
        if (activity.get('mountain')) {
            extraData.bMountaineerClub = true;
            extraData.levelUrl = 'http://sport.hoopeng.cn/api/sport/pathinfo';
        }

        payType = activity.get('pay_type');
        var userObj = activity.get('user_id');
        activity.set('user_info', {
            nickname:userObj.get('nickname'),
            icon:userObj.get('icon')||''
        });
        //简化user_id的返回内容
        var _ = AV._;
        //保留的user keys
        var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "actual_position"];
        activity.set('user_id', _.pick(userObj._toFullJSON(), pickUserKeys));

        var activityFounder = activity.get('user_id');
        founderUserId = activityFounder.id;
        if (userId == activityFounder.id) { //如果是活动发起者，就不用做后续查询了
            query = new AV.Query('ActivityUser');
            query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
            query.notEqualTo('user_id', AV.User.createWithoutData('_User', userId));
            query.descending('createdAt');
            query.limit(10);
            query.include('user_id');
            return query.find();
        } else {
            //查询ActivityUser，主要目的：
            // 1、查自己是否已经报名
            // 2、查该活动最近的报名人
            var promises = [];

            query = new AV.Query('ActivityUser');
            query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
            query.notEqualTo('user_id', AV.User.createWithoutData('_User', userId));
            query.descending('createdAt');
            query.limit(10);
            query.include('user_id', 'order_id');
            promises.push(query.find());

            var query = new AV.Query('ActivityUser');
            query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
            query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
            query.include('user_id', 'order_id');
            promises.push(query.first());

            return Promise.when(promises);
        }
    }).then(function(results, myActivityUser){
        var bHasSignup = false;
        if (results) {   //设置已经报名状态
            var signupUsers = [];
            results.forEach(function(item){
                var user = item.get('user_id');
                if (user) {
                    signupUsers.push({
                        nickname:user.get('nickname')||'',
                        icon:user.get('icon')||''
                    });
                }
            });

            extraData.signupUsers = signupUsers;
        }

        if (myActivityUser) {
            bHasSignup = true;
            var orderObj = myActivityUser.get('order_id');
            if (orderObj) {
                extraData.accountStatus = orderObj.get('accountStatus')||1;
                extraData.bookNumber = orderObj.get('bookNumber')||'';
            }
            if (_.isEmpty(extraData.signupUsers)) {
                var user = myActivityUser.get('user_id');
                extraData.signupUsers = [{
                    nickname:user.get('nickname')||'',
                    icon:user.get('icon')||''
                }];
            }
        }

        extraData.hasSignup = bHasSignup;

        if (!bHasSignup) {
            //若用户还未加入活动，则查询订单状态
            var query = new AV.Query('StatementAccount');
            query.select('accountStatus', 'bookNumber');
            query.equalTo('userId', AV.User.createWithoutData('_User', userId));
            query.equalTo('activityId', AV.Object.createWithoutData('Activity', activityId));
            query.descending('createdAt');
            return query.first();
        } else {
            return AV.Promise.as();
        }
    }).then(function(result){
        if (result) {   //返回订单状态
            extraData.accountStatus = result.get('accountStatus');
            extraData.bookNumber = result.get('bookNumber');
        }

        extraData.tagNames = common.tagNameFromId(currActivity.get('tags'));
        res.success({
            activity:currActivity._toFullJSON(),
            extra:extraData
        });
    }, function(err){
        console.error('获取活动失败:', err);
        res.error('获取活动失败，错误码:'+err.code);
    });
});

/*
    取消报名：函数名 cancelSignupActivity
    @param {
     userId: objectId   取消报名的用户ID
     activityId:objectId 对应活动ID
    }

    处理流程：
    1、先判断是否已过退款日期，若已过，则禁止退款
    2、查找对应的订单，修改订单状态为‘申请退款中’
    3、删除对应的ActivityUser记录
    4、对应的 Activity 当前报名人数减1
    5、hook ActivityUser删除记录，通知组织者我已经退出
 */
AV.Cloud.define('cancelSignupActivity', function(req, res){
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }

    var userId = req.params.userId;
    if (!userId && req.user) {
        userId = req.user.id;
    }
    var activityId = req.params.activityId;
    if (!userId || !activityId) {
        res.error('请传入用户和活动信息！');
        return;
    }
    var activity;
    var order;

    var query = new AV.Query('ActivityUser');
    query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
    query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
    query.include('order_id', 'activity_id');
    query.first().then(function(result){
        if (!result) {
            res.error('未找到报名信息！');
            return;
        }

        activity = result.get('activity_id');
        if (!activity) {
            res.error('对应活动不存在！');
            return;
        }

        if (common.isOfflineSignup(result.get('signupType'))) { //线上报名，直接退出
            res.destroy();
            res.success();
            return;
        }

        var payType = activity.get('pay_type');
        var currDate = new Date();
        var paymentDeadTime = activity.get('payment_dead_time');
        if (common.isOnlinePay(payType) &&
            paymentDeadTime &&
            currDate.getTime()>paymentDeadTime.getTime()) {
            res.error('超过最晚退款时间，请联系发起人退款。');
            return;
        }

        //去的订单和活动founder
        order = result.get('order_id');
        activityFounder = activity.get('user_id');

        var chargeId = order.get('serialNumber');
        if (common.isOnlinePay(payType)) { //如果为线上支付，则先改为申请退款
            order.set('accountStatus', 3); //将订单状态改为申请退款中
            order.save();

            if (chargeId) {
                var url = 'http://pay.imsahala.com/api/ping/refund?'+querystring.stringify({
                        ch_id:chargeId,
                        description:'用户申请退款',
                        amount:order.get('amount')||0
                    });
                console.info('申请退款URL：%s', url);
                //通知PHP server修改订单状态
                AV.Cloud.httpRequest({
                    method: 'GET',
                    url: url
                });
            }
        } else {
            order.set('accountStatus', 5);  //改为退出活动状态
            order.save();
        }

        //删除对应的ActivityUser记录
        result.destroy();
        res.success();
    }, function(err){
        console.error('cancelSignupActivity error:', err);
        res.error('退出报名失败,错误码:'+err.code);
    });
});

/**
 * 取消活动：函数名 cancelActivity
 * @params {
 *  activityId: objectId 活动ID
 *  userId: objectId 发起操作的用户ID，若为当前登陆用户，可不传
 *  cancelReason:string 取消活动原因
 * }
 *
 * @return
 * {
 *  activity:{  //返回activity发生变化的字段
 *      removed:bool ,true or false
 *      activityUpdateNotice:cancelReason
 *    }
 * }
 *
 * 处理流程：
 * 1、设置Activity状态为下限。
 * 2、通知（事件流&push通知）该活动下所有用户。
 * 3、若未线上支付活动，将该活动下订单为已支付的订单状态，改为‘申请退款’
 */
AV.Cloud.define('cancelActivity', function(req, res){
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }

    var activityId = req.params.activityId;
    var cancelReason = req.params.cancelReason;
    var joinUsers = [];     //所有加入活动的ids
    var payType;            //支付方式
    var activityFounder;    //活动发起人
    var activity;           //活动

    if (!activityId || !cancelReason) {
        res.error('请传入相关参数！');
        return;
    }

    var query = new AV.Query('Activity');
    query.get(activityId).then(function(result){
       if (!result) {
           res.error('对应活动不存在！');
           return;
       }
        activity = result;
        activityFounder = result.get('user_id');
        payType = result.get('pay_type');
        if (cancelReason) {
            result.set('activityUpdateNotice', cancelReason);
        }
        result.set('removed', true);
        return result.save();
    }).then(function(result){
        cancelReason = result?result.get('activityUpdateNotice'):'';

        //找到所有参与活动的人
        query = new AV.Query('ActivityUser');
        query.limit(1000);
        query.select('user_id');
        query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
        return query.find();
    }).then(function(results){
        if (!results) {
            res.success({
                activity:{
                    removed:true,
                    activityUpdateNotice:cancelReason
                }
            });
            return;
        }

        results.forEach(function(item){
            var user = item.get('user_id');
            joinUsers.push(user.id);
        });

        if (joinUsers.length) {
            //通知到所有活动参与者，活动已经取消
            var query = new AV.Query('_User');
            query.containedIn('objectId', joinUsers);
            common.sendStatus('cancelActivity', activityFounder, joinUsers, query, {activity:activity});
        }

        if (common.isOnlinePay(payType)) {
            //如果是线上支付，则将该活动下所有已支付订单，改为‘申请退款’状态
            query = new AV.Query('StatementAccount');
            query.equalTo('activityId', activity._toPointer());
            query.equalTo('accountStatus', 2);
            query.limit(500);
            return query.find();
        } else {
            return AV.Promise.as();
        }
    }).then(function(results){
        if (results) {
            results.forEach(function(item){
                item.set('accountStatus', 3);
                item.save();
            });
        }

        res.success({
            activity:{
                removed:true,
                activityUpdateNotice:cancelReason
            }
        });
    }, function(err){
        console.error('活动取消失败：', err);
        res.error('活动取消失败,错误码:'+err.code);
    });
});

/** 支付完成:函数名 paymentComplete
 *          由PHP server收到支付完成通知后，调用此接口
 *  @param {
 *  bookNo:string 订单号
 *  }
 *
 *  处理流程：
 *  1、找到对应的订单，状态改为已支付
 *  2、查找用户是否已经加入ActivityUser表，若已在，则直接返回成功。
 *  3、若不在，查找ActivitySignUpUser对应的报名信息，copy到ActivityUser中
 *  4、添加ActivityUser成功后，对应的活动人数+1
 *
 */
AV.Cloud.define('paymentComplete', function(req, res){
    var bookNo = req.params.bookNo;
    if (!bookNo) {
        res.error('请传入订单号');
        return;
    }
    var timePaid = req.params.timePaid;
    if (timePaid) {
        timePaid = new Date(parseInt(timePaid) * 1000);
    }
    var transactionNo = req.params.transactionNo;

    var user, activity, order;

    var query = new AV.Query('StatementAccount');
    query.include('signupId');
    query.equalTo('bookNumber', bookNo);
    query.first().then(function(result){
        if (!result) {
            res.error('未找到对应的订单！');
            return AV.Promise.error();
        }

        order = result;
        //订单状态改为已支付
        result.set('accountStatus', 2);
        if (timePaid) {
            result.set('paidTime', timePaid);
        }
        if (transactionNo) {
            result.set('transactionNo', transactionNo);
        }
        return result.save();
    }).then(function(result){
        activity = result.get('activityId');
        user = result.get('userId');

        //检测该记录是否已经存在
        query = new AV.Query('ActivityUser');
        query.equalTo('user_id', user);
        query.equalTo('activity_id', activity);
        return query.first();
    }).then(function(result){
        if (result) {
            res.success({
                paid:true
            });

            return AV.Promise.error();
        }

        var signupInfo = order.get('signupId');
        var ActivityUser = common.extendClass('ActivityUser');
        var activityUser = new ActivityUser();
        activityUser.set('sex', signupInfo.get('sex'));
        activityUser.set('real_name', signupInfo.get('realName'));
        activityUser.set('phone', signupInfo.get('phone'));
        activityUser.set('idcard', signupInfo.get('idcard'));
        activityUser.set('signIn', 1);
        activityUser.set('passport_card', signupInfo.get('passportCard'));
        activityUser.set('mtp', signupInfo.get('mtp'));
        activityUser.set('two_way_permit', signupInfo.get('twoWayPermit'));
        activityUser.set('user_id', user._toPointer());
        activityUser.set('activity_id', activity._toPointer());
        activityUser.set('order_id', order._toPointer());
        return activityUser.save();
    }).then(function(result){
        res.success({
                paid:true
            });
    }, function(err){
        if (err && err.code) {
            console.error('处理订单完成失败:', err);
            res.error('处理订单完成失败,错误码:'+err.code);
        }
    });
});

/*
    获取活动报名用户列表
    函数名：
        getActivityUsers2   (用于替换 getActivityUsers)
    参数：
        userId:objectId     用户ID，若不传，则默认为当前登录用户
        activityId:objectId 活动ID
        limit skip:分页查询参数
    返回：
    [
        {
            activityUser: ActivityUser class object
            extra:{
                isFriend:bool 与当前用户的好友关系
            }
        }
    ]
 */
AV.Cloud.define('getActivityUsers2', function(req, res){
    var userId = req.params.userId || (req.user && req.user.id);
    var activityId = req.params.activityId;
    var skip = req.params.skip || 0;
    var limit = req.params.limit || 20;
    var retVal = [];

    if (!activityId) {
        res.error('请传入活动信息！');
        return;
    }

    var query = new AV.Query('ActivityUser');
    query.include('user_id');
    query.include('order_id.signupId');
    query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
    query.skip(skip);
    query.limit(limit);
    query.descending('createdAt');
    query.find().then(function(results){
        if (!results) {
            res.success();
            return;
        }

        var followees = [];
        results.forEach(function(item) {
            var user = item.get('user_id');
            if (user) {
                var userInfo = {
                    nickname:user.get('nickname') || '',
                    icon:user.get('icon')||''
                };
                item.set('user_info', userInfo);
                var order = item.get('order_id');
                if (order) {
                    var signupInfo = order.get('signupId');
                    if (signupInfo) {
                        item.set('sex', signupInfo.get('sex'));
                        item.set('phone', signupInfo.get('phone'));
                        item.set('idcard', signupInfo.get('idcard'));
                        item.set('two_way_permit', signupInfo.get('twoWayPermit'));
                        item.set('passport_card', signupInfo.get('passportCard'));
                        item.set('mtp', signupInfo.get('mtp'));
                        item.set('real_name', signupInfo.get('realName'));
                    }
                }

                followees.push(user);
            }

        });

        var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type", "actual_position"];
        common.findFriendShipForUsers(userId, followees).then(function(friendObj){
            _.each(results, function(item){
                var user = item.get('user_id');
                if (user) {
                    item = item._toFullJSON();
                    item.user_id = _.pick(user._toFullJSON(), pickUserKeys);

                    retVal.push({
                        activityUser:item,
                        extra:{
                            isFriend:friendObj[user.id]
                        }
                    });
                }
            });

            res.success(retVal);
        });

    }, function(err){
        console.error('处理订单完成失败:', err);
        res.error('获取活动用户失败,错误码:'+err.code);
    });
});

/**
 * 获得活动报名用户列表  函数名：getActivityUsers
 * @param activityId:活用ID
 * @param skip:获取数据偏移
 * @param limit:本地查询返回数量
 * @return ActivityUsers
 */
AV.Cloud.define('getActivityUsers', function(req, res){
    var activityId = req.params.activityId;
    var skip = req.params.skip || 0;
    var limit = req.params.limit || 20;
    var retVal = [];

    if (!activityId) {
        res.error('请传入活动信息！');
        return;
    }

    var query = new AV.Query('ActivityUser');
    query.include('user_id');
    query.include('order_id.signupId');
    query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
    query.skip(skip);
    query.limit(limit);
    query.descending('createdAt');
    query.find().then(function(results){
        if (!results) {
            res.success();
            return;
        }

        var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type", "actual_position"];
        results.forEach(function(item) {
            var user = item.get('user_id');
            if (user) {
                var userInfo = {
                    nickname:user.get('nickname') || '',
                    icon:user.get('icon')||''
                };
                item.set('user_info', userInfo);
                var order = item.get('order_id');
                if (order) {
                    var signupInfo = order.get('signupId');
                    if (signupInfo) {
                        item.set('sex', signupInfo.get('sex'));
                        item.set('phone', signupInfo.get('phone'));
                        item.set('idcard', signupInfo.get('idcard'));
                        item.set('two_way_permit', signupInfo.get('twoWayPermit'));
                        item.set('passport_card', signupInfo.get('passportCard'));
                        item.set('mtp', signupInfo.get('mtp'));
                        item.set('real_name', signupInfo.get('realName'));
                    }
                }

                item = item._toFullJSON();
                item.user_id = _.pick(user._toFullJSON(), pickUserKeys);

                retVal.push(item);
            }

        });

        res.success(retVal);
    }, function(err){
        console.error('处理订单完成失败:', err);
        res.error('获取活动用户失败,错误码:'+err.code);
    });
});

/** 注：经约定，部落人员转移消息，由APP自己来发起，server端不参与此过程，该接口废弃
 * 邀请用户加入部落 函数名：inviteActivityUserToClan
 * @param   userIds:array   需要邀请转移的用户
 * @param   clanIds:array   转移到的目标部落
 *
 */
/*
AV.Cloud.define('inviteActivityUserToClan', function(req,res){
    var userId = req.params.userId;
    if (!userId && req.user && req.user.id) {
        userId = req.user.id;
    }
    var userNickname;
    if (req.user) {
        userNickname = req.user.get('nickname');
    }
    var inviteTargetUsers = req.params.userIds;
    var clanIds = req.params.clanIds;

    console.info('inviteActivityUserToClan params,inviteTargetUsers:%s clanIds:%s', inviteTargetUsers,clanIds);

    //查询所有部落信息：icon name
    var query = new AV.Query('Clan');
    query.select('icon', 'title');
    query.containedIn('objectId', clanIds);
    query.find().then(function(clans){
        if (!clans) {
            return AV.Promise.error('没有找到对应的部落信息！');
        }

        clans.forEach(function(clan){
            var clanId = clan.id;
            var clanName = clan.get('title');
            var clanIcon = clan.get('icon');

            var content = userNickname + ' 邀请您加入 ' + clanName + ' 部落。';
            common.postRCMessage(userId, inviteTargetUsers, content, 'inviteUserToClan',
                clanId, {title:'部落邀请', imgUrl:clanIcon});
        });

        res.success();
    }, function(err){
        console.error('inviteActivityUserToClan error:', err);
        res.error('邀请用户失败,错误码:'+err.code);
    });
});
*/

/*  获取订单详细信息  函数名:getStatementDetail
*   参数：
*       bookNo: string 订单号
*       userId: objectId 当前用户ID，若为当前登陆用户，可不传
*       getSignup: bool 是否获取报名信息 默认为false
*   返回：
*       {statementAccount}
*/
AV.Cloud.define('getStatementDetail', function(req, res){
    var bookNo = req.params.bookNo;
    var bGetSignup = req.params.getSignup || false;

    console.info('getStatementDetail params,bookNo:%s bGetSignup:%d', bookNo, bGetSignup);

    var setResultAndReturn = function() {
        statement = statement._toFullJSON();
        statement.activityId = activity._toFullJSON();
        if (bGetSignup) {
            var signupUser = signup.get('userId');
            statement.signupId = signup._toFullJSON();
            //保留的user keys
            var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type"];
            statement.signupId.userId = _.pick(signupUser._toFullJSON(), pickUserKeys);
        }
        res.success(statement);
    }

    var statement, activity, signup, user;
    var query = new AV.Query('StatementAccount');
    query.include('activityId', 'signupId', 'signupId.userId');
    query.equalTo('bookNumber', bookNo);
    query.first().then(function(result){
        if (!result) {
            res.error('订单不存在！');
            return;
        }
        statement = result;
        activity = result.get('activityId');
        signup = result.get('signupId');
        user = result.get('userId');

        var payType = activity.get('pay_type');
        var accountStatus = result.get('accountStatus');
        var serialNumber = result.get('serialNumber');
        if (common.isOnlinePay(payType) && serialNumber && accountStatus==1) {
            //线上支付&订单处于未支付状态，去支付平台同步查询订单实际状态
            return pingpp(common.pingxxAppKey).charges.retrieve(serialNumber);
        } else {
            return AV.Promise.as();
        }
    }).then(function(result){
        if (result && result.paid) {    //是否完成支付
            statement.set('accountStatus', 2);
            if (result.time_paid) { //支付时间
                statement.set('paidTime', new Date(result.time_paid*1000));
            }
            if (result.transaction_no) {    //第三方支付的交易流水号
                statement.set('transactionNo', result.transaction_no);
            }

            var order = statement;
            statement.save().then(function(result){
                setResultAndReturn();

                console.info('查询用户是否已经加入报名列表');
                //查询用户是否已经加入，若没有，则将用户加入ActivityUser
                query = new AV.Query('ActivityUser');
                query.equalTo('user_id', user);
                query.equalTo('activity_id', activity);
                return query.first();
            }).then(function(result){
                if (result) {
                    //已经加入，则不用理会
                    console.info('用户已经加入活动，不用重复加入!');
                    return;
                }

                //将用户加入ActivityUser
                var signupInfo = order.get('signupId');
                var ActivityUser = common.extendClass('ActivityUser');
                var activityUser = new ActivityUser();
                activityUser.set('sex', signupInfo.get('sex'));
                activityUser.set('real_name', signupInfo.get('realName'));
                activityUser.set('phone', signupInfo.get('phone'));
                activityUser.set('idcard', signupInfo.get('idcard'));
                activityUser.set('signIn', 1);
                activityUser.set('passport_card', signupInfo.get('passportCard'));
                activityUser.set('mtp', signupInfo.get('mtp'));
                activityUser.set('two_way_permit', signupInfo.get('twoWayPermit'));
                activityUser.set('user_id', user._toPointer());
                activityUser.set('activity_id', activity._toPointer());
                activityUser.set('order_id', order._toPointer());
                activityUser.save();

                console.info('保存在线付费活动用户完成!userId:%s activityId:%s', user.id, activity.id);
            }, function(err){
                console.error('error in process payment:', err);
            });

            return;
        }

        setResultAndReturn();
    }, function(err){
        console.error('getStatementDetail error:', err);
        res.error('查询订单详情失败,错误码:'+err.code);
    });
});

/** 获取订单列表  函数名：getOrderList
 *  参数：
 *      userId:objectId 用户ID，若为当前登陆用户，可不传
 *      skip:Integer    查询偏移
 *      limit:Integer   本次查询返回数
 */
AV.Cloud.define('getOrderList', function(req, res){
    var userId = req.params.userId;
    if (!userId && req.user) {
        userId = req.user.id;
    }
    var skip = req.params.skip || 0;
    var limit = req.params.limit || 20;
    var retVal = [];

    if (!userId) {
        res.error('请传入用户信息！');
        return;
    }

    var query = new AV.Query('StatementAccount');
    query.equalTo('userId', AV.Object.createWithoutData('_User', userId));
    query.skip(skip);
    query.limit(limit);
    query.include('activityId');
    query.select('payMode', 'serialNumber', 'accountStatus', 'bookNumber', 'activityId', 'payTime');
    query.descending('createdAt');
    query.find().then(function(result){
       if (!result) {
           res.success([]);
           return;
       }

        result.forEach(function(item){
            var activity = item.get('activityId');

            item = item._toFullJSON();
            item.activityId = activity._toFullJSON();
            retVal.push(item);
        });

        res.success(retVal);
    }, function(err){
        console.error('getOrderList error:', err);
        res.error('获取订单列表失败,错误码:'+err.code);
    });
});

/** 获取活动列表
 *  函数名：getActivityList
 *  参数：
 *      userId:objectId 用户ID，若为当前登录用户，可不传
 *      tags:array 用户标签，若为当前登录用户，可不传
 *      skip:Integer 本次查询偏移
 *      limit:Integer  本次查询数量
 *      clanId:objectId 部落ID，当 activityType为 clan时，需要传入。
 *      activityType:
 *          'mainpage'：首页
 *          'mine':我的活动
 *          ‘clan’:部落相关活动
 *          'underway':我的正在进行中的活动
 *          'upcoming':我的未开始活动
 *          'expired':我的已过期活动
 *          'canceled':我的已取消活动
 *  返回:
 *      [
 *          {
 *              activity: Activity Class Object
 *              extra:{
 *                  friendJoin:Integer 好友加入个数,
 *                  hasSignup:bool 当前用户是否加入,
  *                 tagNames:array tagID对应名称
  *              }
 *          }
 *      ]
 */
AV.Cloud.define('getActivityList', function(req, res){
    var userId = req.params.userId || (req.user && req.user.id);
    var tags = req.params.tags;
    if (!tags && req.user) {
        tags = req.user.get('tags');
    }
    var skip = req.params.skip || 0;
    var limit = req.params.limit || 20;
    var activityType = req.params.activityType || 'mainpage';
    var clanId = req.params.clanId;
    var retVal = [];

    var formatResultAndReturn = function(results, res) {
        var retVal = [];

        if (_.isEmpty(results)) {
            res.success();
        } else {
            var activities = [];
            _.each(results, function(activity){
                var retItem = {};
                activities.push(activity._toPointer());
                retItem.activity = activity._toFullJSON();
                retItem.activity.price = retItem.activity.price || '0.00';
                var joinUsers = retItem.activity.joinUsers || [];
                retItem.extra = {
                    friendJoin:/*Math.floor(Math.random()*100)*/0,
                    tagNames:common.tagNameFromId(activity.get('tags'))
                };

                retVal.push(retItem);
            });

            if (_.isEmpty(activities)) {
                res.success(retVal);
            } else {
                var query = new AV.Query('ActivityUser');
                query.equalTo('user_id', AV.User.createWithoutData('User', userId));
                query.containedIn('activity_id', activities);
                query.find().then(function(results){
                    var activityObj = {};
                    _.each(results, function(item) {
                        var activity = item && item.get('activity_id');
                        if (activity) {
                            activityObj[activity.id] = true;
                        }
                    });

                    _.each(retVal, function(item){
                        var activityId = item && item.activity && item.activity.objectId;
                        var extra = item && item.extra;
                        if (extra) {
                            extra.hasSignup = activityObj[activityId] ? true : false;
                        }
                    });

                    res.success(retVal);
                });
            }
        };

    }

    switch (activityType) {
        case 'mainpage':
            var activityClass = common.extendClass('Activity');
            if(req.user && req.user.get('actual_position')){
                var userGeoPoint = req.user.get('actual_position');
            }
            /*  考虑早期活动较少，暂时不按用户标签返回活动
            var queryOr = [];
            if (tags) {
                var tagOr = null;
                for(var i=0;i<tags.length;i++){
                    var tagOr = new AV.Query(activityClass);
                    tagOr.equalTo("tags", tags[i]);
                    queryOr.push(tagOr);
                }

                //查询我创建的活动
                var queryMyCreate = new AV.Query(activityClass);
                queryMyCreate.equalTo('user_id', req.user);
                queryOr.push(queryMyCreate);

                var query= AV.Query.or.apply(null, queryOr);
            }else{
                var query= new AV.Query(activityClass);
            }
            */
            var query = new AV.Query('Activity');
            if (userGeoPoint)
                query.near("position", userGeoPoint);
            var searchDate=new Date();
            query.greaterThan('activity_end_time', searchDate);
            query.limit(limit);
            query.skip(skip);
            query.notEqualTo('removed', true);
            query.descending('rank');
            query.addDescending('createdAt');
            query.select('-hasSignupUsers', '-joinUsers');
            query.notEqualTo('status', 1);
            query.find().then(function(results){
                formatResultAndReturn(results, res);
            }, function(err){
                res.error('查询活动失败,错误码:'+err.code);
            });
            break;

        case 'mine':
            if (!userId) {
                res.error('请传入用户信息！');
                break;
            }
            var queryOr = [];
            var query = new AV.Query('Activity');
            query.equalTo('user_id', AV.Object.createWithoutData('_User', userId));
            queryOr.push(query);

            query = new AV.Query('Activity');
            query.notEqualTo('user_id', AV.Object.createWithoutData('_User', userId));
            query.equalTo('joinUsers', userId);
            queryOr.push(query);

            query = AV.Query.or.apply(null, queryOr);
            query.select('-hasSignupUsers', '-joinUsers');
            query.limit(limit);
            query.skip(skip);
            query.descending('rank');
            query.addDescending('activity_end_time');
            query.addDescending('activity_time');
            query.find().then(function(results){
                formatResultAndReturn(results, res);
            }, function(err){
                res.error('查询活动失败,错误码:'+err.code);
            });
            break;

        case 'underway':
            var nowDate = new Date();
            var queryOr = [];
            var query = new AV.Query('Activity');
            query.equalTo('user_id', AV.Object.createWithoutData('_User', userId));
            query.notEqualTo('removed', true);
            query.lessThanOrEqualTo('activity_time', nowDate);
            query.greaterThanOrEqualTo('activity_end_time', nowDate);
            queryOr.push(query);

            query = new AV.Query('Activity');
            query.notEqualTo('user_id', AV.Object.createWithoutData('_User', userId));
            query.equalTo('joinUsers', userId);
            query.notEqualTo('removed', true);
            query.lessThanOrEqualTo('activity_time', nowDate);
            query.greaterThanOrEqualTo('activity_end_time', nowDate);
            queryOr.push(query);

            query = AV.Query.or.apply(null, queryOr);
            query.select('-hasSignupUsers', '-joinUsers');
            query.limit(limit);
            query.skip(skip);
            query.descending('rank');
            query.addDescending('activity_time');
            query.find().then(function(results){
                formatResultAndReturn(results, res);
            }, function(err){
                res.error('查询活动失败,错误码:'+err.code);
            });
            break;

        case 'upcoming':
            var nowDate = new Date();
            var queryOr = [];
            var query = new AV.Query('Activity');
            query.equalTo('user_id', AV.Object.createWithoutData('_User', userId));
            query.notEqualTo('removed', true);
            query.greaterThan('activity_time', nowDate);
            queryOr.push(query);

            query = new AV.Query('Activity');
            query.notEqualTo('user_id', AV.Object.createWithoutData('_User', userId));
            query.equalTo('joinUsers', userId);
            query.notEqualTo('removed', true);
            query.greaterThan('activity_time', nowDate);
            queryOr.push(query);

            query = AV.Query.or.apply(null, queryOr);
            query.select('-hasSignupUsers', '-joinUsers');
            query.limit(limit);
            query.skip(skip);
            query.descending('rank');
            query.addAscending('activity_time');
            query.find().then(function(results){
                formatResultAndReturn(results, res);
            }, function(err){
                res.error('查询活动失败,错误码:'+err.code);
            });
            break;

        case 'expired':
            var nowDate = new Date();
            var queryOr = [];
            var query = new AV.Query('Activity');
            query.equalTo('user_id', AV.Object.createWithoutData('_User', userId));
            query.notEqualTo('removed', true);
            query.lessThan('activity_end_time', nowDate);
            queryOr.push(query);

            query = new AV.Query('Activity');
            query.notEqualTo('user_id', AV.Object.createWithoutData('_User', userId));
            query.equalTo('joinUsers', userId);
            query.notEqualTo('removed', true);
            query.lessThan('activity_end_time', nowDate);
            queryOr.push(query);

            query = AV.Query.or.apply(null, queryOr);
            query.select('-hasSignupUsers', '-joinUsers');
            query.limit(limit);
            query.skip(skip);
            query.descending('rank');
            query.addDescending('activity_end_time');
            query.find().then(function(results){
                formatResultAndReturn(results, res);
            }, function(err){
                res.error('查询活动失败,错误码:'+err.code);
            });
            break;

        case 'canceled':
            var queryOr = [];
            var query = new AV.Query('Activity');
            query.equalTo('user_id', AV.Object.createWithoutData('_User', userId));
            query.equalTo('removed', true);
            queryOr.push(query);

            query = new AV.Query('Activity');
            query.notEqualTo('user_id', AV.Object.createWithoutData('_User', userId));
            query.equalTo('joinUsers', userId);
            query.equalTo('removed', true);
            queryOr.push(query);

            query = AV.Query.or.apply(null, queryOr);
            query.select('-hasSignupUsers', '-joinUsers');
            query.limit(limit);
            query.skip(skip);
            query.descending('rank');
            query.addDescending('activity_time');
            query.find().then(function(results){
                formatResultAndReturn(results, res);
            }, function(err){
                res.error('查询活动失败,错误码:'+err.code);
            });
            break;

        case 'clan':
            if (!clanId) {
                res.error('请传入部落信息！');
                break;
            }
            var Clan = common.extendClass('Clan');
            var clan = new Clan();
            clan.id = clanId;
            clan.fetch().then(function(clan){
                //找到clan的founder
                var clanFounder = clan && clan.get('founder_id');
                if (!clanFounder) {
                    res.error('未找到该部落的创建者!');
                    return;
                }

                var queryOr = [];
                var query = new AV.Query('Activity');
                query.equalTo('allow_join_type', 2);
                query.equalTo('allow_join_data', clanId);
                query.notEqualTo('removed', true);
                queryOr.push(query);

                var clanIds = req.user.get('clanids');
                if (_.indexOf(clanIds, clanId) >= 0) {
                    //如果是部落成员，则该部落酋长发布的公开活动，也可以看到
                    query = new AV.Query('Activity');
                    query.equalTo('allow_join_type', 1);
                    query.equalTo('user_id', clanFounder);
                    query.notEqualTo('removed', true);
                    queryOr.push(query);
                }

                query = AV.Query.or.apply(null, queryOr);
                query.skip(skip);
                query.limit(limit);
                query.select('-hasSignupUsers', '-joinUsers');
                query.descending('rank');
                query.addDescending('createdAt');
                query.notEqualTo('status', 1);
                query.find().then(function(results){
                    formatResultAndReturn(results, res);
                }, function(err){
                    res.error('查询活动失败,错误码:'+err.code);
                });
            });

            break;
    }

});

/** 获取自己发起或已经加入的活动
 *  函数名：getActivityJoined
 *  参数：
 *      userId:objectId 用户ID，若未当前登录用户，可不传
 *      skip:Integer  查询偏移
 *      limit:Integer 返回数量
 *  返回：[
 *      activity class object,only include 'index_thumb_image' 'title'
 *  ]
 */
AV.Cloud.define('getActivityJoined', function(req, res){
    var userId = req.params.userId;
    if (!userId && req.user){
        userId = req.user.id;
    }
    var skip = req.params.skip;
    var limit = req.params.limit;
    var queryOr = [];
    var retVal = [];

    var query = new AV.Query('Activity');
    query.equalTo('user_id', AV.Object.createWithoutData('_User', userId));
    query.notEqualTo('objectId', '5524cdcae4b03381b308d12d');
    queryOr.push(query);

    query = new AV.Query('Activity');
    query.notEqualTo('user_id', AV.Object.createWithoutData('_User', userId));
    query.equalTo('joinUsers', userId);
    query.notEqualTo('objectId', '5524cdcae4b03381b308d12d');
    queryOr.push(query);

    query = AV.Query.or.apply(null, queryOr);
    query.limit(limit);
    query.skip(skip);
    query.descending('createdAt');
    query.select('index_thumb_image', 'title');
    query.find().then(function(results) {
        if (!results) {
            res.success();
            return;
        }

        results.forEach(function(activity){
            retVal.push(activity._toFullJSON());
        });

        res.success(retVal);
    }, function(err){
        console.error('getActivityJoined error:', err);
        res.error('查询加入的活动失败,错误码:'+err.code);
    });
});

/** 判断是否能够创建活动
 *  函数名： canCreateActivity
 *  参数：
 *      userId: objectId 用户ID，若未当前登录用户，可不传
 *  返回：
 *      {
 *          canCreate: bool  true or false
 *          errMsg: 不能创建原因
 *      }
 */
AV.Cloud.define('canCreateActivity', function(req, res) {
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }

    var userId = req.params.userId;
    if (!userId && req.user) {
        userId = req.user.id;
    }

    res.success({
        canCreate:true
    });
    /*
    var query = new AV.Query('Clan');
    query.equalTo('founder_id', AV.User.createWithoutData('_User', userId));
    query.first().then(function(result){
        if (!result) {
            res.success({
                canCreate:false,
                errMsg:'只有部落酋长才能发活动哦，快去创建部落吧！'
            });
            return;
        }

        res.success({
            canCreate:true
        });
    }, function(err){
        console.error('canCreateActivity query error:', err);
        res.success({
            canCreate:false,
            errMsg:'创建活动失败:'+err?err.message:''
        });
    });
    */
}) ;

/** 活动签到
 *  函数名：signinActivity
 *  参数：
 *      userId:objectId 用户ID，若未当前登录用户，可不传
 *      activityId:objectId 当前签到活动ID
 *  返回：
 *      success or error
 */
AV.Cloud.define('signinActivity', function(req, res){
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }

    var userId = req.params.userId;
    if (!userId && req.user) {
        userId = req.user.id;
    }
    var activityId = req.params.activityId;

    var query = new AV.Query('ActivityUser');
    query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
    query.equalTo('activity_id', AV.Object.createWithoutData('Activity', activityId));
    query.select('signIn', 'activity_id');
    query.first().then(function(result){
       if (!result) {
           res.error('请扫描本次活动的二维码！');
           return;
       }

        var bHasSignin = (result.get('signIn')||1)>1?true:false;
        if (!bHasSignin) {  //若未签到过，修改签到状态
            var activity = result.get('activity_id');

            result.set('signIn', 2);
            result.save();

            if (activity) { //对应活动的签到人数+1
                activity.fetchWhenSave(true);
                activity.increment('signin_num');
                activity.save();
            }

        }

        res.success();
    }, function(err){
        console.error('签到失败:',err);
        res.error('签到失败,错误码:'+err.code);
    });
});

/*
    取消订单
    函数名：  cancelOrder
    参数：
        orderNo:string 订单号
    返回：
        success or fail
 */
AV.Cloud.define('cancelOrder', function(req, res){
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }

    var orderNo = req.params.orderNo;
    if (!orderNo) {
        res.error('请传入订单信息！');
        return;
    }

    var query = new AV.Query('StatementAccount');
    query.equalTo('bookNumber', orderNo);
    query.first().then(function(order){
        var currAccountStatus = order.get('accountStatus');
        if (currAccountStatus == 1) {
            order.set('accountStatus', 6);
            order.save();
            res.success();
        } else {
            res.error('当前订单状态不允许取消！');
        }
    }, function(err){
        console.error('cancelOrder error:', err);
        res.error('取消订单失败,错误码:'+err.code);
    });
});

/**
    根据订单号生成支付订单信息
    函数名：newChargeWithOrder
    orderNo:撒哈拉支付流水号
    channel:支付方式  alipay（默认） or wx，
    amount:支付金额，单位为分
    subject:商品名称
    describe:商品描述
    返回：
    {
        chargeId:pingxx charge id
    }
 */
AV.Cloud.define('newChargeWithOrder', function(req, res){
    var orderNo = req.params.orderNo;
    var channel = req.params.channel || 'alipay';   //支付渠道：alipay, wx, upacp, bfb
    var amount = req.params.amount || 0;
    var subject = req.params.subject;   //商品名称
    var describe = req.params.describe; //商品描述
    var statement, charge;

    if (!orderNo) {
        res.error('请传入订单号！');
        return;
    }

    var query = new AV.Query('StatementAccount');
    query.select('bookNumber', 'serialNumber', 'activityId');
    query.include('activityId');
    query.equalTo('bookNumber', orderNo);
    query.first().then(function(result){
        if (!result) {
            res.error('没有查到对应的订单！');
            return;
        }

        //判断活动状态：1、是否已过报名时间 2、报名人数是否已满，否则不允许付款
        var activity = result.get('activityId');
        if (activity) {
            var bRemoved = activity.get('removed') || false;
            if (bRemoved) {
                res.error('活动已取消！');
                return;
            }
            var nowTime = new Date();
            var deadSignupTime = activity.get('dead_time');
            if (nowTime.getTime() > deadSignupTime.getTime()) {
                res.error('活动报名时间已过！');
                return;
            }
            var maxUserNum = activity.get('max_num');
            var currUserNum = activity.get('current_num');
            if (maxUserNum && currUserNum>=maxUserNum) {
                res.error('活动报名人数已满！');
                return;
            }
        }

        statement = result;
        return pingpp(common.pingxxAppKey).charges.create({
            order_no:  orderNo,
            app:       {id: common.pingxxAppId},
            channel:   channel,
            amount:    parseInt(amount),
            client_ip: req.remoteAddress || '10.0.0.1',
            currency:  "cny",
            subject:   common.sliceString(subject, 30), //max unicode length is 32
            body:      common.sliceString(describe, 126)//max unicode length is 128
        });
    }).then(function(result){
        if (!result) {
            res.error('生成订单失败！');
            return;
        }
        charge = result;

        statement.set('serialNumber', charge.id);
        statement.set('amount', charge.amount);
        switch (channel) {
            case 'wx':
                statement.set('payMode', 2);
                break;
            case 'alipay':
            default:
                statement.set('payMode', 1);
                break;
        }
        return statement.save();
    }).then(function(statement){
        res.success(charge);
    }, function(err){
        console.error(err);
        res.error('生成订单失败,错误码:'+err.code);
    });
});

/*
    退款完成
    函数名：
        refundComplete
    参数：
        chargeId:支付的chargeId
        refundId:对应退款的refundId
    返回：
        success or error
 */
AV.Cloud.define('refundComplete', function(req, res){
    var chargeId = req.params.chargeId;
    var refundId = req.params.refundId;

    if (!chargeId || !refundId) {
        res.error('缺少对应的参数！');
        return;
    }

    var query = new AV.Query('StatementAccount');
    query.include('activityId');
    query.equalTo('serialNumber', chargeId);
    query.first().then(function(order){
        if (!order) {
            res.error('对应的支付订单不存在！');
            return;
        }

        var user = order.get('userId');
        var activity = order.get('activityId');
        var founder = activity.get('user_id');

        order.set('accountStatus', 4);
        order.set('refundId', refundId);
        order.save();

        //通知用户退款成功
        var query = new AV.Query('_User');
        query.equalTo('objectId', user.id);
        common.sendStatus('refundSuccess', founder, user, query, {activity:activity});

        res.success({
            refund:true
        });
    });
});

/*
    活动更新
    函数名：updateActivity
    参数：
        activityId:objectId  活动ID
    返回:
        success or error
 */
AV.Cloud.define('updateActivity', function(req, res){
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }

    var activityId = req.params.activityId;
    if (!activityId) {
        res.error('请传入活动信息！');
        return;
    }

    var activity = AV.Object.createWithoutData('Activity', activityId);
    var query = new AV.Query('ActivityUser');
    query.limit(1000);
    query.include('activity_id');
    query.select('user_id', 'activity_id');
    query.equalTo('activity_id', activity);
    query.find().then(function(results) {
        if (!results) {
            res.success();
            return;
        }

        var activityName;
        var joinUsers = [];
        results.forEach(function(item){
            var user = item.get('user_id');
            joinUsers.push(user.id);
            var currActivity = item.get('activity_id');
            activityName = currActivity.get('title');
        });

        if (!joinUsers.length) {
            console.info('%s 活动没有参与者，不用发消息通知。', activityId);
            res.success();
            return;
        }

        //通知到所有活动参与者，活动已经更新
        activity.set('title', activityName);
        var query = new AV.Query('_User');
        query.containedIn('objectId', joinUsers);
        common.sendStatus('updateActivity', req.user, joinUsers, query, {activity:activity});

        res.success();
    });
});