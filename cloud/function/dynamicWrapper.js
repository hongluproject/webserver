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
            var date1, date2, date3;

            console.info("limit:%d maxId:%d", limit, maxId);

            //查询事件流，获取用户关注的所有动态
            var query = AV.Status.inboxQuery(AV.User.createWithoutData('_User',userId));
            query.include('dynamicNews');
//            query.include('source');
            query.include('dynamicNews.user_id');
            query.equalTo('messageType', 'newPost');
            query.limit(limit);
            query.maxId(maxId);
            query.exists('dynamicNews');
            date1 = new Date();
            query.find().then(function(statuses){
                date2 = new Date();
                console.info("dynamic finding use time:%d ms", date2.getTime()-date1.getTime());

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
                likeQuery.equalTo('user_id', AV.User.createWithoutData('_User', userId));
                likeQuery.containedIn('external_id', dynamicIdArray);
                return likeQuery.find();
            }, function(err){
                //查询失败
                console.dir(err);
                res.error('查询关注动态信息失败！');
            }).then(function(likes){
                date3 = new Date();
                console.info("dynamic like finding use time:%d ms", date3.getTime()-date2.getTime());
                for (var i in likes) {
                    likeTarget[likes[i].get('external_id')] = true;
                }


                var hpTags = AV.HPGlobalParam.hpTags;
                //将所有动态返回，添加isLike，记录点赞状态
                for (var i in statusesReturn) {
                    var currDynamic = statusesReturn[i].data.dynamicNews;
                    if (likeTarget[currDynamic.objectId] == true)	//添加点赞状态字段
                        currDynamic.isLike = true;
                    else
                        currDynamic.isLike = false;

                    //从tagId转换tagName，并返回给APP
                    if (hpTags) {
                        var arrayTagName = [];
                        for (var k in currDynamic.tags) {
                            arrayTagName.push(hpTags[currDynamic.tags[k]].get('tag_name') || '');
                        }
                        /*
                        if (arrayTagName.length) {
                            currDynamic.tagNames = arrayTagName;
                        }
                        */
                    }

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
