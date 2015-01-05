/**
 * Created by fugang on 14/12/15.
 */

/** 用户创建部落的前的一些判断
 *
 */
AV.Cloud.beforeSave('Clan', function(req,res) {
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

            if (userResult.get('power') != 2) {
                res.error('您没有权限创建部落！');
                return;
            }

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
    var clanUser = AV.Object.extend('ClanUser');
    clanUser.set('user_level', 2);
    clanUser.set('clan_id', clanObj._toPointer());
    clanUser.set('user_id', clanObj.get('founder_id'));
    clanUser.save();
});
