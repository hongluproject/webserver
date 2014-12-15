/**
 * Created by fugang on 14/12/12.
 */

/**
 *  获取动态
 */
AV.Cloud.define('getDynamic', function(req,res){
    var dynamicType = req.params.dynamicType || 'followeDynamic';	//获取的动态类型
    switch (dynamicType) {
        case "followeDynamic":	//查询我关注的动态，需要通过事件流查询
            /**	request param
             {
                 dynamicType:followeDynamic,
                 limit:N default is 20,
                 maxId:N default is zero
             }
             */
            var userId = req.params.userId;
            if (!userId) {
                res.error('缺少用户信息！');
                return;
            }
            var limit = req.params.limit || 20;
            var maxId = req.params.maxId || 0;
            var statusesReturn = [];	//保存第一次查询返回的status
            var likeTarget = {};	//记录该用户点过赞的id
            var returnUserItem = {	//动态中发布者信息，可以保留返回的字段
                objectId:1,
                username:1,
                nickname:1,
                className:1,
                icon:1,
                __type:1
            };

            //查询事件流，获取用户关注的所有动态
            var query = AV.Status.inboxQuery(AV.User.createWithoutData('_User',userId));
            query.include('dynamicNews');
            query.include('source');
            query.include('dynamicNews.user_id');
            query.equalTo('messageType', 'newPost');
            query.limit(limit);
            query.maxId(maxId);
            query.exists('dynamicNews');
            query.find().then(function(statuses){
                //获取所有动态objectId，再查询该用户对这些动态是否点过赞
                var dynamicIdArray = [];
                for (var i in statuses) {
                    if (statuses[i].data.dynamicNews) {
                        dynamicIdArray.push(statuses[i].data.dynamicNews.objectId);
                        statusesReturn.push(statuses[i]);
                    }
                }

                //查询点赞表
                var likeClass = AV.Object.extend("Like");
                var likeQuery = new AV.Query(likeClass);
                likeQuery.containedIn('external_id', dynamicIdArray);
                likeQuery.equalTo('user_id', AV.User.createWithoutData('_User', userId));
                return likeQuery.find();
            }, function(err){
                //查询失败
                console.dir(err);
                res.error('查询关注动态信息失败！');
            }).then(function(likes){
                for (var i in likes) {
                    likeTarget[likes[i].get('external_id')] = true;
                }


                //将所有动态返回，添加isLike，记录点赞状态
                for (var i in statusesReturn) {
                    var currDynamic = statusesReturn[i].data.dynamicNews;
                    if (likeTarget[currDynamic.objectId] == true)	//添加点赞状态字段
                        currDynamic.isLike = true;
                    else
                        currDynamic.isLike = false;

                    //遍历user_id，去掉不需要返回的字段，减少网络传输
                    for (var k in currDynamic.user_id) {
                        if (returnUserItem[k] != 1) {
                            delete currDynamic.user_id[k];
                        }
                    }
                }

                res.success(statusesReturn);
            }, function(error){
                res.error('查询点赞状态失败');
            });

            break;
    }
});
