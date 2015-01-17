/**
 * Created by fugang on 15/1/17.
 */
var common = require('cloud/common.js');

/** 更新部落信息，同步部落最大数，是否满员等信息
 *
 */
AV.Cloud.define('updateClanParam', function(req, res){
    //批量脚本：修改部落最大成员数
    var clanId = req.params.clanId;
    var queryClan = new AV.Query('Clan');
    queryClan.include('founder_id');
    if (clanId) {
        queryClan.equalTo('objectId', clanId);
    }
    queryClan.find().then(function(results){
        for (var i in results) {
            var userLevel = results[i].get('founder_id').get('level');
            var maxClanUsers = common.clanParam.getMaxClanUsers(userLevel);
            var currClanUsers = results[i].get('current_num');
            results[i].set('max_num', maxClanUsers);
            results[i].set('is_full', currClanUsers>=maxClanUsers);
            results[i].save();
        }
        res.success();
    });
});
