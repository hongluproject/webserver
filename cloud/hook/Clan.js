/**
 * Created by fugang on 14/12/15.
 */
var common = require('cloud/common.js');
var clanParam = require('cloud/common.js').clanParam;
var myutils = require('cloud/utils.js');

/** 用户创建部落的前的一些判断
 *
 */
AV.Cloud.beforeSave('Clan', function(req,res) {
    if (!req.user || !req.user.id) {
        res.error('请登录账号!');
        return;
    }
    if (req.user.get('status') == 2) {
        res.error('您被禁止创建部落!');
        return;
    }

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

            //根据用户等级，修改该部落可以最多加入的人数
            var userLevel = userResult.get('level') || 1;
            var nMaxClanUser = clanParam.getMaxClanUsers(userLevel);
            var fouderUserInfo = {
                icon:founderUser.get('icon') || '',
                nickname:founderUser.get('nickname') || ''
            };

            clanObj.set('founder_userinfo', fouderUserInfo);
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

        userResult.fetchWhenSave(true);
        userResult.addUnique('createdClanIds', clanObj.id);
        userResult.save().catch(function(err){
            console.error('save user %s error ', reqUser.id, err);
        });

    }, function(err){
        console.error('find user %s error ', reqUser.id, err);
    });

    //保存部落分享链接
    var urlPath = common.isSahalaDevEnv()?'http://apidev.imsahala.com/clan/':'http://api.imsahala.com/clan/';
    clanObj.set('shareUrl', urlPath.concat(clanObj.id));
    clanObj.save();

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
