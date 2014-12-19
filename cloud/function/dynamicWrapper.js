/**
 * Created by fugang on 14/12/12.
 */

/**
 *  获取动态
 */
AV.Cloud.define('getDynamic', function(req,res){
    function addLikesAndReturn(userId, dynamics, response) {
        var likeTarget = {};	//记录该用户点过赞的id
        var returnUserItem = {	//动态中发布者信息，可以保留返回的字段
            objectId:1,
            username:1,
            nickname:1,
            className:1,
            icon:1,
            __type:1
        };

        //获取所有动态objectId，再查询该用户对这些动态是否点过赞
        var dynamicIdArray = [];
        for (var i=0; i<dynamics.length; i++) {
            if (dynamics[i].get('user_id')) {
                dynamicIdArray.push(dynamics[i].id);
            } else {    //删除不合法的数据
                dynamics.splice(i, 1);
                i--;
            }
        }

        //查询点赞表
        var likeClass = AV.Object.extend("Like");
        var likeQuery = new AV.Query(likeClass);
        likeQuery.equalTo('user_id', AV.User.createWithoutData('_User', userId));
        likeQuery.containedIn('external_id', dynamicIdArray);
        likeQuery.find().then(function(likes) {
            for (var i in likes) {
                likeTarget[likes[i].get('external_id')] = true;
            }


            var hpTags = AV.HPGlobalParam.hpTags;
            //将所有动态返回，添加isLike，记录点赞状态，添加tagName字段，去掉user字段中多余的信息
            for (var i in dynamics) {
                var currDynamic = dynamics[i];
                if (likeTarget[currDynamic.id] == true)	//添加点赞状态字段
                    currDynamic.set('isLike', true);
                else
                    currDynamic.set('isLike', false);

                //从tagId转换tagName，并返回给APP
                if (hpTags) {
                    var arrayTagName = [];
                    for (var k in currDynamic.tags) {
                        arrayTagName.push(hpTags[currDynamic.tags[k]].get('tag_name') || '');
                    }
                    if (arrayTagName.length) {
                        currDynamic.set('tagName', arrayTagName);
                    }
                }

                //遍历user_id，去掉不需要返回的字段，减少网络传输
                var rawUser = currDynamic.get('user_id');
                if (rawUser && rawUser.id) {
                    var postUser = AV.User.createWithoutData('_User', rawUser.id);
                    postUser.set('icon', rawUser.get('icon'));
                    postUser.set('nickname', rawUser.get('nickname'));
                    currDynamic.set('user_id', postUser);
                }

            }

            response.success(dynamics);
        });

    }

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

            //查询事件流，获取用户关注的所有动态
            var query = AV.Status.inboxQuery(AV.User.createWithoutData('_User',userId));
            var statusReturn = [];
            query.include('dynamicNews');
//            query.include('source');
            query.include('dynamicNews.user_id');
            query.containedIn('messageType', ['newPost', 'newQuestion']);
            query.limit(limit);
            query.maxId(maxId);
            query.exists('dynamicNews');
            date1 = new Date();
            query.find().then(function(statuses){
                if (!statuses) {
                    res.success([]);
                    return;
                }
                statusReturn = statuses;
                date2 = new Date();
                console.info("userid:%s dynamic finding use time:%d ms", userId, date2.getTime()-date1.getTime());
                //获取所有动态objectId，再查询该用户对这些动态是否点过赞
                var dynamicIdArray = [];
                for (var i=0; i<statuses.length; i++) {
                    if (statuses[i].data.dynamicNews && statuses[i].data.source) {
                        dynamicIdArray.push(statuses[i].data.dynamicNews.objectId);
                    } else {
                        statuses.splice(i, 1);
                        i--;
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
                console.info("userid:%s,dynamic like finding use time:%d ms", userId, date3.getTime()-date2.getTime());
                for (var i in likes) {
                    likeTarget[likes[i].get('external_id')] = true;
                }


                var hpTags = AV.HPGlobalParam.hpTags;
                //将所有动态返回，添加isLike，记录点赞状态
                for (var i in statusReturn) {
                    var currDynamic = statusReturn[i].data.dynamicNews;
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
                        if (arrayTagName.length) {
                            currDynamic.tagNames = arrayTagName;
                        }
                    }

                    //遍历user_id，去掉不需要返回的字段，减少网络传输
                    for (var k in currDynamic.user_id) {
                        if (returnUserItem[k] != 1) {
                            delete currDynamic.user_id[k];
                        }
                    }
                }

                res.success(statusReturn);
            }, function(error){
                res.error('查询点赞状态失败');
            });

            break;

        case 'mineDynamic':     //我发出的动态
            var userId = req.params.userId;
            if (!userId) {
                res.error('缺少用户信息！');
                return;
            }
            var limit = req.params.limit || 20;
            var skip = req.params.skip || 0;
            var type = req.params.type || 2;

            var query = new AV.Query('DynamicNews');
            query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
            query.equalTo('type', parseInt(type));
            query.include('user_id');
            query.skip(skip);
            query.limit(limit);
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }
                addLikesAndReturn(userId, dynamics, res);
            });
            break;

        case 'commentDynamic':  //我评论过的动态
            var userId = req.params.userId;
            if (!userId) {
                res.error('缺少用户信息！');
                return;
            }
            var limit = req.params.limit || 20;
            var skip = req.params.skip || 0;
            var type = req.params.type || 2;
            var query = new AV.Query('DynamicNews');
            query.skip(skip);
            query.limit(limit);
            query.equalTo('commentUsers', userId);
            query.equalTo('type', parseInt(type));
            query.find().then(function(dynamics) {
                if (!dynamics) {
                    res.success([]);
                    return;
                }
                addLikesAndReturn(userId, dynamics, res);
            });
            break;
    }
});
