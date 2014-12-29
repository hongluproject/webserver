/**
 * Created by fugang on 14/12/12.
 */

/*
 获取资讯列表包装函数
 request params:
 favoriteIds：收藏的资讯列表
 userId:用户objectId，若不传，则点赞信息全部为false
 limit: 本次查询最多返回条目数
 skip: 本次查询起始查询位置
 area: 筛选指定area
 tag: 筛选指定tag
 cateid: 筛选指定cate
 */
AV.Cloud.define('getNews', function(req, res){
    var HPGlobalParam = AV.HPGlobalParam || {};
    var userId = req.params.userId;
    var limit = req.params.limit || 20;
    var skip = req.params.skip || 0;
    var area = req.params.area;
    var tag = req.params.tag;
    var cateid = req.params.cateid;
    var favoriteIds = req.params.favoriteIds || [];
    var likeTarget = {};	//记录该用户点过赞的id
    var newsResults = [];
    var queryOr = [];
    var newsClass = AV.Object.extend('News');
    if (area) {
        var areaOr = null;
        for(var i=0;i<area.length;i++){
            var areaOr = new AV.Query(newsClass);
            areaOr.equalTo("areas", area[i]);
            queryOr.push(areaOr);
        }
    }
    if (tag) {
        var tagOr = null;
        for(var i=0;i<tag.length;i++){
            var tagOr = new AV.Query(newsClass);
            tagOr.equalTo("tags", tag[i]);
            queryOr.push(tagOr);
        }
    }
    if (cateid) {
        var cateOr = null;
        for(var i=0;i<cateid.length;i++){
            var cateOr = new AV.Query(newsClass);
            cateOr.equalTo("cateids", cateid[i]);
            queryOr.push(cateOr);
        }
    }

    if(area||tag||cateid){
        var queryNews= AV.Query.or.apply(null, queryOr);
    }else{
        var queryNews= new AV.Query(newsClass);

    }
    queryNews.select(["comment_count","cateids","title","up_count","list_pic",
        "allow_comment","areas","contents_url","allow_forward","tags","rank"]);
    queryNews.limit(limit);
    queryNews.skip(skip);
    queryNews.equalTo('status', 1);
    if (favoriteIds.length > 0) {
        queryNews.containedIn('objectId', favoriteIds);
    }
    var newsIds = [];
    queryNews.find().then(function(results) {
        newsResults = results;
        for (var i in results) {
            newsIds.push(results[i].id);

            //返回cate名称
            var arrayCateName = [];
            var arrayCate = results[i].get('cateids');
            for (var k in arrayCate) {
                var name = '';
                if (HPGlobalParam.hpCates[arrayCate[k]]) {
                    name = HPGlobalParam.hpCates[arrayCate[k]].get('cate_name');
                }
                arrayCateName.push(name);
            }
            if (arrayCateName.length) {
                results[i].set('catesName', arrayCateName);
            }

            //返回area名称
            var arrayAreaName = [];
            var arrayArea = results[i].get('areas');
            for (var k in arrayArea) {
                var name = '';
                if (HPGlobalParam.hpAreas[arrayArea[k]]) {
                    name = HPGlobalParam.hpAreas[arrayArea[k]].get('title');
                }
                arrayAreaName.push(name);
            }
            if (arrayAreaName.length) {
                results[i].set('areasName', arrayAreaName);
            }

            //返回tags名称
            var arrayTagName = [];
            var arrayTag = results[i].get('tags');
            for (var k in arrayTag) {
                var name = '';
                if (HPGlobalParam.hpTags[arrayTag[k]]) {
                    name = HPGlobalParam.hpTags[arrayTag[k]].get('tag_name');
                }
                arrayTagName.push(name);
            }
            if (arrayTagName.length) {
                results[i].set('tagsName', arrayTagName);
            }

        }

        if (userId && results && results.length) {
            //根据资讯&用户id，查询点赞信息
            var likeClass = AV.Object.extend("Like");
            var queryLike = new AV.Query(likeClass);
            queryLike.equalTo('like_type', 1);
            queryLike.equalTo('user_id', AV.User.createWithoutData('_User', userId));
            queryLike.containedIn('external_id', newsIds);
            return queryLike.find();
        }
    }).then(function(likes){
        for (var k in likes) {
            likeTarget[likes[k].get('external_id')] = likes[k].id;
        }
        //将所有动态返回，添加isLike，记录点赞状态
        for (var k in newsResults) {
            var currNew = newsResults[k];
            var likeObjectId = likeTarget[currNew.id];
            if (likeObjectId)	//添加点赞状态字段
               // currNew.set('isLike', true);
               currNew.set('likeObjectId', likeObjectId);
        }

        res.success(newsResults);

    });
});