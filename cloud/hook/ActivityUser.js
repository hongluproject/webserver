/**
 * Created by fugang on 14/12/30.
 */
var common = require('cloud/common.js');

/** 判断活动人数是否已经超过上限
 *
 */

/*
暂时不对 ActivityUser 做beforeSave，因为前端均调用云函数，在写数据前前已经判断
AV.Cloud.beforeSave('ActivityUser', function(req, res) {
    console.info('enter ActivityUser beforeSave');
    var activityId = req.object.get('activity_id').id;
    var queryActivity = new AV.Query('Activity');
    queryActivity.get(activityId).then(function(activityResult){
        if (!activityResult) {
            res.error('活动ID不存在:'+activityId);
            return;
        }
        var currNum = activityResult.get('current_num');
        var maxNum = activityResult.get('max_num');
        console.info('maxNum:%d currNum:%d', maxNum, currNum);
        if (!maxNum || maxNum==0) {  //没有指定最大报名人数，不用判断
            console.info('max num is null ', maxNum);
            res.success();
            return;
        }
        if (currNum >= maxNum) {
            res.error('报名人数已经超过上限！');
            return;
        }

        res.success();
    }, function(error) {
        console.error('get %s user info error:', activityId, error);
        res.error(error);
    });
});
*/


AV.Cloud.afterSave('ActivityUser', function(req){
    var ActivityObj = req.object.get('activity_id');
    var userObj = req.object.get('user_id');
    var queryActivity = new AV.Query('Activity');
    queryActivity.select('user_id', 'title', 'current_num');
    queryActivity.get(ActivityObj.id, {
        success:function(activity) {
            if (!activity) {
                return;
            }

            activity.increment('current_num');
            activity.addUnique('joinUsers', userObj.id);
            activity.save();

            //加入融云组群 for 活动聊天
            AV.Cloud.run('imAddToGroup',{
                userid:userObj.id,
                groupid:common.activityGroupIdForRC(activity.id),
                groupname:activity.get('title')
            });

            var founderId = activity.get('user_id').id;
            var query = new AV.Query('_User');
            query.equalTo('objectId', founderId);
            common.sendStatus('joinActivity', userObj, activity.get('user_id'), query,{"activity":activity});
        }
    });
});


AV.Cloud.afterDelete('ActivityUser', function(req){
    var ActivityObj = req.object.get('activity_id');
    var userObj = req.object.get('user_id');
    if (!ActivityObj || !userObj) {
        return;
    }

    var query = new AV.Query('Activity');
    query.select('user_id', 'current_num', 'title');
    query.get(ActivityObj.id).then(function(activity){
        if (!activity) {
            return;
        }

        activity.increment('current_num', -1);
        activity.remove('joinUsers', userObj.id);
        activity.save();

        //从融云群组里面退出 for 活动聊天
        AV.Cloud.run('imQuitGroup',{
            userid:userObj.id,
            groupid:common.activityGroupIdForRC(ActivityObj.id)
        });

        //通知到对应活动的Founder，告知有人退出了活动
        var activityFounder = activity.get('user_id');
        query = new AV.Query('_User');
        query.equalTo('objectId', activityFounder.id);
        common.sendStatus('quitActivity', userObj, activityFounder, query, {activity:activity});
    });

});


