/**
 * Created by fugang on 14/12/15.
 */

var clanParam = require('cloud/common.js').clanParam;

/** 用户创建部落的前的一些判断
 *
 */
AV.Cloud.beforeSave('Clan', function(req,res) {
    var clanObj = req.object;
    var founderUser = req.object.get('founder_id');
    if (!founderUser || !founderUser.id) {
        res.error('数据错误！');
        return;
    }
    var queryUser = new AV.Query('_User');
    queryUser.get(founderUser.id, {
        success:function(userResult) {
            if (!userResult) {
                res.error('用户不存在！');
                return;
            }

            //根据power修改该部落可以最多加入的人数
            var nMaxClanUser = clanParam.maxClanUsers[1];
            if (userResult.get('power') >= 2) {
                nMaxClanUser = clanParam.maxClanUsers[2];
            }

            clanObj.set('max_num', nMaxClanUser);

            res.success();
        },
        error:function(error) {
            res.error('查询用户失败:'+error.message);
        }
    })
});

/* 用户创建部落后：部落创建者默认加入到ClanUser表中

 */
AV.Cloud.afterSave('Clan', function(req) {
    var clanObj = req.object;
    var reqUser = clanObj.get('founder_id');

    //更新用户表里面用户所创建的部落信息
    var queryUser = new AV.Query('_User');
    queryUser.select('createdClanIds');
    queryUser.get(reqUser.id).then(function(userResult){
        if (!userResult) {
            console.error('find user %s failed', reqUser.id);
            return;
        }

        userResult.addUnique('createdClanIds', clanObj.id);
        userResult.save();
    });

    //创建者信息加入到ClanUser表中
    var ClanUser = AV.Object.extend('ClanUser');
    var clanUser = new ClanUser();
    clanUser.set('user_level', 2);
    clanUser.set('clan_id', clanObj._toPointer());
    clanUser.set('user_id', clanObj.get('founder_id'));
    clanUser.save();
});

/** 用户删除部落后，用户表里面的部落信息也需要去除
 *
 */
AV.Cloud.afterDelete('Clan', function(req){
    var reqUser = req.user;
    var clanId = req.object.id;

    var queryUser = new AV.Query('_User');
    queryUser.select('clanids', 'createdClanIds');
    queryUser.get(reqUser.id).then(function(userResult) {
        if (userResult) {
            userResult.remove('clanids', clanId);
            userResult.remove('createdClanIds', clanId);
            userResult.save();
        }
    });
});
