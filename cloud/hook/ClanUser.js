/**
 * Created by fugang on 14/12/12.
 */

/** 部落用户添加数据前，检查是否已经超过部落上限
 *
 */
AV.Cloud.beforeSave('ClanUser', function(req,res){
    var clanObj = req.object.get('clan_id');
    var maxClanNum = clanObj.get('max_num');
    var currClanNum = clanObj.get('current_num');
    if (currClanNum >= maxClanNum) {
        res.error('超出部落最大用户数！');
        return;
    }

    res.success();
});

/** 部落用户增加时，部落表里面的人数加1，用户表里面添加到所归属的部落
 *
 */
AV.Cloud.afterSave('ClanUser', function(req){
    var clanObj = req.object.get('clan_id');
    var userObj = req.object.get('user_id');

    //部落人数加1
    clanObj.increment('current_num');
    clanObj.save();

    //查找到对应的用户object
    var query = new AV.Query('_User');
    query.select('clanids');
    query.get(userObj.id, {
        success:function(result) {
            var clanIds = result.get('clanids');
            //查找是否已经存在，若不存在，则添加后保存
            var currClanId = clanObj.id;
            console.info("current clan id:%s", currClanId);
            var bExist = false;
            for (var i in clanIds) {
                if (currClanId == clanIds[i]) {
                    bExist = true;
                    break;
                }
            }
            if (!bExist) {
                clanIds.push(currClanId);
                result.set('clanids', clanIds);
                result.save();
                console.dir(result);
            }
        }
    });

});

/** 用户从部落退出时，部落表里面的人数减1，从用户表里面所归属的部落去除
 *
 */
AV.Cloud.afterDelete('ClanUser', function(req){
    var clanObj = req.object.get('clan_id');
    var userObj = req.object.get('user_id');

    clanObj.increment('current_num', -1);
    clanObj.save();

    //从用户表的部落数组里面，删除当前的部落再保存。
    //查找到对应的用户object
    var query = new AV.Query('_User');
    query.select('clanids');
    query.get(userObj.id, {
        success:function(result) {
            var currClanId = clanObj.id;
            var clanIds = result.get('clanids');
            var deleteIdx = -1;
            for (var i in clanIds) {
                if (currClanId == clanIds[i]) {
                    deleteIdx = i;
                    break;
                }
            }
            if (deleteIdx >= 0) {
                clanIds.splice(deleteIdx, 1);
                result.set('clanids', clanIds);
                result.save();
            }
        }
    });
});