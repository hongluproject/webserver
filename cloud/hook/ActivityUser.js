/**
 * Created by fugang on 14/12/30.
 */

/** 判断活动人数是否已经超过上限
 *
 */
AV.Cloud.beforeSave('ActivityUser', function(req, res) {
    var activityId = req.object.get('activity_id').id;
    var queryActivity = new AV.Query('Activity');
    queryActivity.get(activityId).then(function(activityResult){
        if (!activityResult) {
            res.error('活动ID不存在:'+activityId);
            return;
        }
        var currNum = activityResult.get('current_num');
        var maxNum = activityResult.get('max_num');
        if (!maxNum) {  //没有指定最大报名人数，不用判断
            console.info('max num is null');
            return;
        }
        if (currNum >= maxNum) {
            res.error('报名人数已经超过上限！');
            return;
        }
    }, function(error) {
        console.error('get %s user info error:', activityId, error);
        res.error(error);
    });
});