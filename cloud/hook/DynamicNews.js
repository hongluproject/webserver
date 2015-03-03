/**
 * Created by fugang on 14/12/11.
 */
var utils = require('cloud/utils.js');
var common = require('cloud/common.js');


/** 发布动态后，通知到所有关注我的人
 *
 */
AV.Cloud.afterSave('DynamicNews', function(request){
    var postUser = request.object.get('user_id');
    if (!postUser) {
        console.info("DynamicNews afterSave:user is null!");
        return;
    }
    var clanObj = request.object.get('clan_id');

    var queryUser = new AV.Query('_User');
    queryUser.select("nickname", "clanids");
    queryUser.get(postUser.id, {
        success:function(userObj) {
            if (!userObj) {
                return;
            }

            //该用户发布动态数加1
            var messageType = 'newPost';
            var type = request.object.get('type');   //1:ask 2:dynamic
            switch (type) {
                case 1:
                    messageType = 'newQuestion';
                    userObj.increment('questionCount');
                    break;
                case 2:
                    messageType = 'newPost';
                    userObj.increment('dynamicCount');
                    break;
            }
            userObj.save();

            var clansOfUser = userObj.get('clanids');
            var tagsOfDynamic = request.object.get('tags');

            //如果用户没有设置动态所归属的部落，则需要将该动态自动加入所属标签的部落中
            var queryOr = [];
            var clanOfDynamic = request.object.get('clan_ids');
            if (!clanOfDynamic && clansOfUser && tagsOfDynamic && tagsOfDynamic.length>0) {
                for(var i in tagsOfDynamic){
                    var clanOr = new AV.Query('Clan');
                    clanOr.equalTo("tags", tagsOfDynamic[i]);
                    queryOr.push(clanOr);
                }
                var queryClan = AV.Query.or.apply(null, queryOr);
                queryClan.containedIn('objectId', clansOfUser);
                queryClan.find().then(function(results){
                    var clanids = [];
                    for(var i in results) {
                        clanids.push(results[i].id);
                    }

                    var DynamicObj = request.object;
                    var DynamicObjId = DynamicObj.id;
                    DynamicObj.set('share_url', 'https://hoopeng.avosapps.com/dynamic/' + DynamicObjId);
                    if (clanids.length > 0) {
                        DynamicObj.set('clan_ids', clanids);
                    }
                    DynamicObj.save();
                });
            } else {
                var DynamicObj = request.object;
                var DynamicObjId = DynamicObj.id;
                DynamicObj.set('share_url', 'https://hoopeng.avosapps.com/dynamic/' + DynamicObjId);
                DynamicObj.save();
            }

            if (!clanObj) { //如果是在部落里面发布动态，则不同步到事件流
                common.sendStatus(messageType, postUser, null, null, {dynamicNews:request.object});
            }
        }
    })
});

/** 动态删除后，将对应的status也清除掉，该动态对应的事件流也会相应消失
 *
 */
AV.Cloud.afterDelete('DynamicNews', function(request) {
    var type = request.object.get('type');   //1:ask 2:dynamic
    var user = request.object.get('user_id');

    var query = new AV.Query('_Status');
    query.equalTo('dynamicNews', request.object._toPointer());
    query.equalTo('messageType', 'newPost');
    query.equalTo('source', user._toPointer());
    query.first().then(function(status){
        if (status && status.id) {
            var deleteStatus = new AV.Status();
            deleteStatus.id = status.id;
            deleteStatus.destroy(); //调用后，对应的inbox信息也将会清除

            console.info('destroy dynamic %s, status %s ok!', request.object.id, status.id);
            status.destroy();
        }
    });

    //用户发布动态数减1
    switch(type) {
        case 1:
            user.increment('questionCount', -1);
            break;
        case 2:
            user.increment('dynamicCount', -1);
            break;
    }
    user.save();
});
