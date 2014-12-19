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

/** 部落用户增加时:
 * 1、部落表里面的人数加
 * 2、用户表里面添加到所归属的部落
 * 3、用户添加到对应的融云群组
 *
 */
AV.Cloud.afterSave('ClanUser', function(req){
    var clanObj = req.object.get('clan_id');
    var userObj = req.object.get('user_id');

    //部落人数加1
    clanObj.increment('current_num');
    clanObj.save();

    //该用户加入部落数加1
    userObj.increment('clanCount');
    userObj.save();

    //查找到对应的用户object
    var query = new AV.Query('_User');
    query.select('clanids');
    query.get(userObj.id, {
        success:function(user) {
            if (!user) {
                console.warn('ClanUser afterSave userid %s not found!', userObj.id);
                return;
            }

            user.addUnique('clanids', clanObj.id);
            user.save();
        }
    });

    //找到该部落的founder
    var queryClan = new AV.Query('Clan');
    queryClan.select('founder_id');
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

            //向部落拥有者发送消息流，告知我已经加入该部落
            var query = new AV.Query('_User');
            query.equalTo('objectId', founderId);

            var status = new AV.Status(null, '加入了你的部落！');
            status.data.source = userObj._toPointer();
            status.query = query;
            status.set('messageType', 'addToClan');
            status.send().then(function(status){
                console.info('加入部落事件流发送成功！');
            },function(error) {
                console.error(error);
            });
        }
    });

    //加入融云组群
    AV.Cloud.run('imAddToGroup',{
        userid:userObj.id,
        groupid:clanObj.id,
        groupname:'hoopengGroup'
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

    //部落成员数减1
    clanObj.increment('current_num', -1);
    clanObj.save();

    //用户所在部落数减1
    userObj.increment('clanCount', -1);
    userObj.save();

    //从用户表的部落数组里面，删除当前的部落再保存。
    //查找到对应的用户object
    var query = new AV.Query('_User');
    query.select('clanids');
    query.get(userObj.id, {
        success:function(user) {
            if (!user) {
                console.warn('ClanUser afterDelete user id %s not found!', userObj.id);
                return;
            }

            user.remove('clanids', clanObj.id);
            user.save();
        }
    });

    //找到该部落的founder
    var queryClan = new AV.Query('Clan');
    queryClan.select('founder_id');
    queryClan.get(clanObj.id, {
        success:function(clan) {
            if (!clan) {
                console.warn('ClanUser afterDelete userid %s not found!', userObj.id);
                return;
            }
            var founder = clan.get('founder_id');
            if (!founder) {
                console.error('ClanUser afterDelete,clan %d founder id do not exist!', clanObj.id);
                return
            }
            //告知该用户，他已经从该部落中移除
            var query = new AV.Query('_User');
            query.equalTo('objectId', userObj.id);

            var status = new AV.Status(null, '从部落中移除！');
            status.data.source = founder._toPointer();
            status.query = query;
            status.set('messageType', 'removeFromClan');
            status.send().then(function(status){
                console.info('部落移除事件流发送成功！');
            },function(error) {
                console.error(error);
            });
        }
    });

    //从融云群组里面退出
    AV.Cloud.run('imQuitGroup',{
        userid:userObj.id,
        groupid:clanObj.id
    });
});