/**
 * Created by fugang on 14/12/12.
 */

var common = require('cloud/common.js');
var clanParam = common.clanParam;
var utils = require('cloud/utils.js');

/** 部落用户添加数据前，检查是否已经超过部落上限
 *
 */
AV.Cloud.beforeSave('ClanUser', function(req,res){
    var clanObj = req.object.get('clan_id');
    var userObj = req.object.get('user_id');

    if (!clanObj.id || !userObj.id) {
        res.error('请输入正确的数据!');
        return;
    }

    //先检测用户是否已经加入该部落
    var queryClan = new AV.Query('ClanUser');
    queryClan.equalTo('clan_id', clanObj);
    queryClan.equalTo('user_id', userObj);
    queryClan.count({
        success:function(count) {
            if (count > 0) {
                res.error('用户已经加入该部落！');
                return;
            }

            //查询部落表，判断用户是否已经超过上限
            var query = new AV.Query('Clan');
            query.include("founder_id.level");
            query.get(clanObj.id, {
                success:function(clan) {
                    if (!clan) {
                        console.info('部落不存在:%s', clan.id);
                        res.error('部落不存在！');
                        return;
                    }
                    var userLevel = clan.get("founder_id").get("level");
                    var maxClanNum = clanParam.getMaxClanUsers(userLevel);
                    var currClanNum = clan.get('current_num');
                    if (currClanNum >= maxClanNum) {
                        res.error('超出部落最大用户数！');
                        return;
                    }

                    res.success();
                },
                error:function(error) {
                    console.error('beforeSave ClanUser query error:', error);
                    res.error('部落不存在！');
                }
            })
        },
        error:function(error) {
            console.error('beforSave ClanUser queryClan error:', error);
            res.success();
        }
    });

});

/** 部落用户增加时:
 * 1、部落表里面的人数加
 * 2、用户表里面添加到所归属的部落
 * 3、用户添加到对应的融云群组
 *
 */
AV.Cloud.afterSave('ClanUser', function(req){
    var clanObj = req.object.get('clan_id');
    var userObj = req.object.get('user_id');
    var userLevel = req.object.get('user_level');

    //查找到对应的用户object
    var query = new AV.Query('_User');
    query.select('clanCount', 'clanids', 'level');
    query.get(userObj.id).then(function(user) {
        if (!user) {
            console.error('ClanUser afterSave userid %s not found!', userObj.id);
            return;
        }

        user.increment('clanCount');    //部落人数加1
        user.addUnique('clanids', clanObj.id);  //部落ID加入用户表
        user.save();

        //根据用户等级获取成长对象
        var level = user.get('level');
        console.info('user %s added clan %s to user class ok', user.id, clanObj.id);

        //找到该部落的founder
        //如果不是创建者，该部落人数加1
        //修改部落是否已满的状态
        var queryClan = new AV.Query('Clan');
        queryClan.select('founder_id', 'title', 'current_num', 'max_num');
        queryClan.get(clanObj.id, {
            success:function(clan) {
                if (!clan) {
                    console.error('部落不存在:%s', clanObj.id);
                    return;
                }
                var founderId = clan.get('founder_id').id;
                if (!founderId) {
                    console.error('ClanUser afterSave,clan %s founder id do not exist!', founderId);
                    return;
                }

                var currUserNum = clan.get('current_num');
                var maxUserNum = clanParam.getMaxClanUsers(level);
                if (userLevel != 2) {   //不是创建者，则该部落当前人数加1
                    //部落人数加1
                    clan.increment('current_num');
                    currUserNum++;

                    console.info('user %s is not clan founder, clan num increment', userObj.id);
                }
                clan.set('is_full', currUserNum>=maxUserNum);
                clan.save();

                //加入融云组群
                AV.Cloud.run('imAddToGroup',{
                    userid:userObj.id,
                    groupid:clanObj.id,
                    groupname:clan.get('title')
                });

                //向部落拥有者发送消息流，告知我已经加入该部落
                var query = new AV.Query('_User');
                query.equalTo('objectId', founderId);

                if(userObj.id!=clan.get('founder_id').id){
                    common.sendStatus('addToClan', userObj, clan.get('founder_id'), query);
                }
            }
        });
    });
});

/** 用户从部落退出时：
 * 1、部落表里面的人数减1
 * 2、从用户表里面所归属的部落去除
 * 3、该用户冲对应的融云群组退出
 *
 */
AV.Cloud.afterDelete('ClanUser', function(req){
    var clanObj = req.object.get('clan_id');
    var userObj = req.object.get('user_id');

    //从用户表的部落数组里面，删除当前的部落再保存。
    //查找到对应的用户object
    var query = new AV.Query('_User');
    query.select('clanids', 'clanCount');
    query.get(userObj.id, {
        success:function(user) {
            if (!user) {
                console.warn('ClanUser afterDelete user id %s not found!', userObj.id);
                return;
            }

            //删除用户所在的部落
            user.remove('clanids', clanObj.id);
            //用户所在部落数减1
            user.increment('clanCount', -1);
            user.save();
        }
    });

    //找到该部落的founder
    var queryClan = new AV.Query('Clan');
    queryClan.select('founder_id', 'current_num', 'max_num', 'is_full');
    queryClan.get(clanObj.id, {
        success:function(clan) {
            if (!clan) {
                console.warn('ClanUser afterDelete userid %s not found!', userObj.id);
                return;
            }
            var founder = clan.get('founder_id');
            if (!founder) {
                console.error('ClanUser afterDelete,clan %d founder id do not exist!', clanObj.id);
                return;
            }

            var currUserNum = clan.get('current_num');
            var maxUserNum = clan.get('max_num');

            //部落成员数减1
            clan.increment('current_num', -1);
            currUserNum--;

            //设置部落是否满员状态
            clan.set('is_full', currUserNum>=maxUserNum);
            clan.save();

            var currUser = req.user;
            if (currUser) {
                if (currUser.id == founder.id) {    //酋长移除用户
                    //告知该用户，他已经从该部落中移除
                    var query = new AV.Query('_User');
                    query.equalTo('objectId', userObj.id);
                    common.sendStatus("removeFromClan", founder, userObj, query, {clan:clan});
                } else if (currUser.id == userObj.id) { //用户主动退出
                    //告知酋长，他已经从该部落中退出
                    var query = new AV.Query('_User');
                    query.equalTo('objectId', founder.id);
                    common.sendStatus("quitClan", userObj, founder, query, {clan:clan});
                }
            }

        }
    });

    //从融云群组里面退出
    AV.Cloud.run('imQuitGroup',{
        userid:userObj.id,
        groupid:clanObj.id
    });
});