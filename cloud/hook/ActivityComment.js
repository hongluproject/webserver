/**
 * Created by fugang on 15/1/15.
 */

AV.Cloud.afterSave('ActivityComment', function(req) {
    var activityObj = req.object.get('activity_id');
    activityObj.fetchWhenSave(true);
    activityObj.increment('comment_count');
    activityObj.save();
});
