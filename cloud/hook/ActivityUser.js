/**
 * Created by fugang on 14/12/30.
 */
var common = require('cloud/common.js');

/** 判断活动人数是否已经超过上限
 *
 */
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


AV.Cloud.afterSave('ActivityUser', function(req){
    var ActivityObj = req.object.get('activity_id');
    var userObj = req.object.get('user_id');
    var query = new AV.Query('_User');
    query.get(userObj.id).then(function(user) {
        var queryActivity = new AV.Query('Activity');
        queryActivity.select('user_id');
        queryActivity.get(ActivityObj.id, {
            success:function(activity) {
                var founderId = activity.get('user_id').id;
                var query = new AV.Query('_User');
                query.equalTo('objectId', founderId);
                common.sendStatus('joinActivity', userObj, activity.get('user_id'), query,{"activity":activity});
            }
        });
    });
});




