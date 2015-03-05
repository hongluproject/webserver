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






/** 取消加入活动
 * @params {
 *  userId: String 用户ID
 *  activityId : String 用户ID
 *  userGroup:[{"realName":"\u96ea\u677e","idcard":"321111198306182318","phone":"15955159604"},{"realName":"\u96f7\u4e91\u6d4b\u8bd5","idcard":"321111198306182318","phone":"15955159603"}]} * }
 *
 *  */
AV.Cloud.define('signUpActivity', function(req, res) {
    var userId = req.params.userId;
    var teamId = req.params.teamId;
    var activityId = req.params.activityId;
    var userGroup = req.params.userGroup;
    if (!userId || !activityId) {
        res.error('请输入参数！');
        return;
    }
    console.info('signUpActivity param, userId:%s activityId:%s "userGroup:%s', userId, activityId,userGroup);



    var addTeamMemberAndAddSignUpUser = function(userGroup,userId,ActivityId){
        var ActivitySignUpUser = AV.Object.extend("ActivitySignUpUser");
        var activitySignUpUser = new ActivitySignUpUser();
        activitySignUpUser.set("realName", userGroup.realName);
        activitySignUpUser.set("phone", userGroup.mobilePhoneNumber);
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

        });
    }

    var addUserAndAddActivityMembers = function(userGroup){
        for (var k=0; k<userGroup.length; k++) {
            (function(i){
                //查找已注册过的用户如果没有则帮助注册
                var UserClass = AV.Object.extend("_User");
                var userQuery = new AV.Query(UserClass);
                userQuery.select('mobilePhoneNumber');
                //todo 没有填写phone
                userQuery.equalTo('mobilePhoneNumber', userGroup[i].phone);
                userQuery.first({
                    success: function(result) {
                        if(!result){
                            var user = new AV.User();
                            user.set("nickname", userGroup[i].realName);
                            user.set("username", userGroup[i].phone);
                            user.set("password", "123456");
                            user.set("mobilePhoneNumber", userGroup[i].phone);
                            user.signUp(null, {
                                success: function(userResult) {
                                    addTeamMemberAndAddSignUpUser(userGroup[i],userResult.id,activityId);
                                },
                                error: function(error) {
                                    console.log(error);
                                }
                            });
                        }
                        else{
                            addTeamMemberAndAddSignUpUser(userGroup[i],result.id,activityId);
                        }
                    },
                    error: function(error) {
                        console.log(error);
                    }
                })
            })(k);
        }
    }


    addUserAndAddActivityMembers(userGroup);


});