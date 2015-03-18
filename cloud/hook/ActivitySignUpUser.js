/**
 * Created by fugang on 15/3/18.
 */

AV.Cloud.afterSave('ActivitySignUpUser', function(req) {
    var userObj = req.object.get('userId');
    var activityObj = req.object.get('activityId');
    if (!userObj || !activityObj) {
        return;
    }

    var query = new AV.Query('Activity');
    query.select('signupUsers');
    query.get(activityObj.id).then(function(activity){
       if (!activity) {
           return;
       }

        activity.addUnique('signupUsers', userObj.id);
        activity.save();
    });
});
