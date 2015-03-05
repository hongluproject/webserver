var common = require('cloud/common.js');

AV.Cloud.afterSave('Activity', function(request) {
    var ActivityObj = request.object;
    var ActivityId = ActivityObj.id;
    ActivityObj.set('share_url', 'https://hoopeng.avosapps.com/activity/' + ActivityId);
    ActivityObj.save();

    var query = new AV.Query('Goods');
    query.equalTo('activityId', AV.Object.createWithoutData('Activity', ActivityId));
    query.count({
        success: function(count){
            if(count == 0){
                var Goods = AV.Object.extend('Goods');
                var goods = new Goods();
                goods.set('activityId', AV.Object.createWithoutData('Activity', ActivityId));
                goods.save();
            }
            return;
         },
        error: function(err){
            console.info("save goods error "+ err);
        }
    });


});