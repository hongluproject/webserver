/**
 * Created by fugang on 15/1/15.
 */

AV.Cloud.afterSave('ActivityComment', function(req, res) {
    var activityId = req.object.get('activity_id').id;

    var queryActivity = new AV.Query('Activity');
    queryActivity.get(activityId, function(activity){
       if (!activity) {
           res.error('没有找到对应的活动 '+activityId);
           return;
       }

        activity.increment('current_num');
        activity.save();
    });
});
