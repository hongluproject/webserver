AV.Cloud.afterSave('Activity', function(req, res) {
    var ActivityObj = request.object;
    var ActivityId = Activity.id;
    ActivityObj.set('share_url', 'https://hoopeng.avosapps.com/activity/' + ActivityId);
    ActivityObj.save();
});