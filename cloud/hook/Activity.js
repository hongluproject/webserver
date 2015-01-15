AV.Cloud.afterSave('Activity', function(request) {
    var ActivityObj = request.object;
    var ActivityId = Activity.id;
    ActivityObj.set('share_url', 'https://hoopeng.avosapps.com/activity/' + ActivityId);
    ActivityObj.save();
});