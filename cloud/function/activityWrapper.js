/**
 * Created by fugang on 14/12/30.
 */

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
            var ActivityUserClass = AV.Object.extend('ActivityUser');
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

        //更新当前报名人数
        activityResult.increment('current_num', userCount);
        activityResult.save();
       // common.postRCMessage(likeUser.id,postUser.id,'点赞了你的动态','newLike',dynamic.id);

        res.success();
    }, function(error) {
        console.error('joinActivity error:', error);
        res.error('加入活动失败！');
    });
});

/** 取消加入活动
 * @params {
 *  userId: String 用户ID
 *  activityId: String 活动ID
 * }
 */
AV.Cloud.define('quitActivity', function(req, res) {
    var userId = req.params.userId;
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

        //当前参加活动的人数递减
        var activity = AV.Object.createWithoutData('Activity', activityId);
        activity.increment('current_num', -activityUserResults.length);
        activity.save();

        res.success();
    }, function(error) {
        console.error('quitActivity failed:', error);
        res.error('取消活动加入失败!');
    });
});






/** 添加报名
 * @params {
 *  userId: objectId 用户ID
 *  activityId : objectId 用户ID
 *  teamId: objectId 团队ID
 *  userGroup:[ {"realName":"\u96ea\u677e","idcard":"321111198306182318","phone":"15955159604"},
*               {"realName":"\u96f7\u4e91\u6d4b\u8bd5","idcard":"321111198306182318","phone":"15955159603"}
 *          ]
 *  payMode:Integer 在线支付方式(支付宝。微信)  1：支付宝 2：微信
 *  accountStatus:Interger 订单状态：1待支付  2已支付 3退款  4取消
 *
 *  */
AV.Cloud.define('signUpActivity', function(req, res) {
    //找到有哪些用户未注册，对未注册的用户先注册
    var addTeamMemberAndAddSignUpUser = function(userGroup,userId,ActivityId){
        var ActivitySignUpUser = AV.Object.extend("ActivitySignUpUser");
        var activitySignUpUser = new ActivitySignUpUser();
        activitySignUpUser.set("realName", userGroup.realName);
        activitySignUpUser.set("phone", userGroup.phone);
        activitySignUpUser.set('userId', AV.Object.createWithoutData('_User', userId));
        activitySignUpUser.set('activityId', AV.Object.createWithoutData('Activity', activityId));
        activitySignUpUser.save().then(function(success){
            if(teamId){
                var ActivityTeamMembers = AV.Object.extend("ActivityTeamMembers");
                var activityTeamMembers = new ActivityTeamMembers();
                activityTeamMembers.set('userId', AV.Object.createWithoutData('_User', userId));
                activityTeamMembers.set('teamId', AV.Object.createWithoutData('ActivityTeam', teamId));
                activityTeamMembers.save();
            }
        },function(error){
            console.error('addTeamMemberAndAddSignUpUser error:', error);
        });
    }

    //取得用户传入的参数
    var userId = req.params.userId;
    var teamId = req.params.teamId;
    var activityId = req.params.activityId;
    var userGroup = JSON.parse(req.params.userGroup);
    if (!userId || !activityId) {
        res.error('请输入参数！');
        return;
    }
    var payMode = req.params.payMode||1;
    var accountStatus =  req.params.accountStatus||1;
    var _ = AV._;

    console.info('signUpActivity param, userId:%s activityId:%s payMode:%d accountStatus:%d "userGroup:',
        userId, activityId, payMode, accountStatus, userGroup);

    //团队所有报名成员手机号码列表
    var groupUserPhoneList = [];
    var groupUserMap = {};
    for (var i in userGroup) {
        groupUserPhoneList.push(userGroup[i].phone);
        groupUserMap[userGroup[i].phone] = userGroup[i];
    }

    //根据提供的手机号码，找到已经注册的用户
    var UserClass = AV.Object.extend("_User");
    var userQuery = new AV.Query(UserClass);
    userQuery.select('mobilePhoneNumber');
    userQuery.containedIn('mobilePhoneNumber', groupUserPhoneList);
    userQuery.find().then(function(results){
        var signedUserPhoneList = [];
        for (var i in results) {    //标注已经报名状态
            var currPhone = results[i].get('mobilePhoneNumber');
            groupUserMap[currPhone].signed = true;
            groupUserMap[currPhone].userId = results[i].id;
        }

        for (var k in groupUserMap) {
            var userItem = groupUserMap[k];
            if (userItem.signed) {
                //已注册，直接加入team表
                addTeamMemberAndAddSignUpUser(userItem, userItem.userId, activityId);
            } else {
                //对未注册的用户，先注册，然后加入team表
                var user = new AV.User();
                user.set("nickname", userItem.realName);
                user.set("username", userItem.phone);
                //默认注册密码，为手机号后6位
                var defaultPwd = userItem.phone.substring(userItem.phone.length-6);
                user.set("password", defaultPwd);
                user.set("mobilePhoneNumber", userItem.phone);
                user.signUp(null, {
                    success: function(userResult) {
                        //注册完成，再加入team表中
                        addTeamMemberAndAddSignUpUser(userItem, userResult.id, activityId);

                        //短信告知该手机用户，需要调用雪松提供的接口
                    },
                    error: function(error) {
                        console.log(error);
                    }
                });
            }
        }

        return AV.Promise.as();
    }).then(function(){
        //最后创建订单
        var goodsClass = AV.Object.extend("Goods");
        var goodsQuery = new AV.Query('Goods');
        goodsQuery.equalTo('activityId', AV.Object.createWithoutData('Activity', activityId));
        goodsQuery.first({
            success:function (result){
                var goodId = result.id;
                //获取时间戳
                var timestamp = (Date.parse(new Date()))/1000;
                var rand4Number =   function s4(){
                    result = '';
                    var data = [0,1,2,3,4,5,6,7,8,9,'a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
                    for(var i=0;i<4;i++){ //产生20位就使i<20
                        r=Math.floor(Math.random()*62); //16为数组里面数据的数量，目的是以此当下标取数组data里的值！
                        result+=data[r]; //输出20次随机数的同时，让rrr加20次，就是20位的随机字符串了。
                    }
                    return result;
                }
                var StatementAccount = AV.Object.extend("statementAccount");
                var statementAccount = new StatementAccount();
                statementAccount.set('payMode', payMode);
                statementAccount.set('bookNumber', timestamp+rand4Number());
                statementAccount.set('userId',  AV.Object.createWithoutData('_User', userId));
                statementAccount.set('activityId',  activityId);
                statementAccount.set('goodId', AV.Object.createWithoutData('Goods', goodId));
                statementAccount.set('accountStatus', accountStatus);
                statementAccount.save(null, {
                    success: function (Order) {
                        //将订单号返回给APP
                        res.success({orderNo:Order.get('bookNumber')});
                    },
                    error: function (date,error) {
                        console.log(error);
                        res.error('创建订单失败：', error);
                    }
                });
            },
            error: function(error) {
                console.log(error);
                res.error('创建订单失败：', error);
            }

        });
    });
});

/** 获取活动详情
 *  @params {
 *    activityId: objectId 活动ID
 *  }
 */
AV.Cloud.define('getActivityDetail', function(req, res){
    var activityId = req.params.activityId;
    if (!activityId) {
        return res.error('请传入活动ID！');
    }

    var queryActivity = new AV.Query('Activity');
    queryActivity.include('user_id');
    queryActivity.notEqualTo('removed', true);
    queryActivity.equalTo('objectId', activityId);
    queryActivity.first().then(function(activity){
        if (!activity) {
            return res.error('没有找到对应的活动！');
        }

        var userObj = activity.get('user_id');
        activity.set('user_info', {
            nickname:userObj.get('nickname'),
            icon:userObj.get('icon')
        });

        //简化user_id的返回内容
        var _ = AV._;
        //保留的user keys
        var pickUserKeys = ["objectId", "username", "nickname", "className", "icon", "__type"];
        activity.set('user_id', _.pick(userObj._toFullJSON(), pickUserKeys));

        res.success(activity);
    }, function(err){
        res.error('获取活动失败:', err);
    });
});

