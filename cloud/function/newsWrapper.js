/**
 * Created by fugang on 14/12/12.
 */

var common = require('cloud/common.js');
var _ = AV._;

/*
    获取资讯列表
    函数名：
        getNews2  (用于替换getNews)
    参数：
        userId:object 用户ID，若不传，则为当前登录用户
        tags:array    筛选tags，若不传，则为当前登录用户的兴趣标签
        skip、limit:   分页查询参数
        cates:array   筛选的cate
        areas:array   筛选指定area
        favoriteIds:array 查询指定收藏的资讯
 返回：[
         {
             news: News class object,
             extra:{
                 tagNames: array 对应资讯标签名称
                 isLike: bool    该用户是否点赞过
                 like: Like class object 对应的点赞对象，若有该对象，则表示用户点赞过
             }
         },
         ...
     ]
 */
AV.Cloud.define('getNews2', function(req, res){
    var HPGlobalParam = AV.HPGlobalParam || {};
    var userId = req.params.userId || (req.user && req.user.id);
    var limit = req.params.limit || 20;
    var skip = req.params.skip || 0;
    var areas = req.params.areas;
    var tags = req.params.tags || (req.user&&req.user.get('tags'));
    var cates = req.params.cates;
    var favoriteIds = req.params.favoriteIds || [];
    var likeTarget = {};	//记录该用户点过赞的id
    var newsResults = [];
    var queryOr = [];
    var newsClass = common.extendClass('News');

    if (_.isEmpty(favoriteIds)) {
        if (areas) {
            var areaOr = null;
            for(var i=0;i<areas.length;i++){
                var areaOr = new AV.Query(newsClass);
                areaOr.equalTo("areas", areas[i]);
                queryOr.push(areaOr);
            }
        }
        if (tags) {
            var tagOr = null;
            for(var i=0;i<tags.length;i++){
                var tagOr = new AV.Query(newsClass);
                tagOr.equalTo("tags", tags[i]);
                queryOr.push(tagOr);
            }
        }
        if (cates) {
            var cateOr = null;
            for(var i=0;i<cates.length;i++){
                var cateOr = new AV.Query(newsClass);
                cateOr.equalTo("cateids", cates[i]);
                queryOr.push(cateOr);
            }
        }
    }

    if(_.isEmpty(queryOr)){
        var queryNews= new AV.Query(newsClass);
    }else{
        var queryNews= AV.Query.or.apply(null, queryOr);
    }
    queryNews.select(["-contents"]);
    queryNews.limit(limit);
    queryNews.skip(skip);
    queryNews.notEqualTo('status', 2);     //只显示上线的内容
    if (_.isEmpty(favoriteIds)) {
        queryNews.notEqualTo('from', 1);      //只显示系统爬取的内容
    }
    queryNews.descending('rank');
    queryNews.addDescending('publicAt');
    queryNews.include('clanCateId', 'clanId');
    if (favoriteIds.length > 0) {
        queryNews.containedIn('objectId', favoriteIds);
    }

    var allNews;
    queryNews.find().then(function(results){
        allNews = results;

        var newsIds = [];
        _.each(results, function(newsItem){
            newsIds.push(newsItem.id);
        });

        if (_.isEmpty(newsIds)) {
            return AV.Promise.as();
        } else {
            var query = new AV.Query('Like');
            query.equalTo('like_type', 1);
            query.containedIn('external_id', newsIds);
            query.equalTo('user_id', AV.User.createWithoutData('_User', userId));
            query.notEqualTo('like', false);
            return query.find();
        }
    }).then(function(likes){
        var likeObj = {};
        _.each(likes, function(likeItem){
            likeObj[likeItem.get('external_id')] = likeItem;
        });

        var pickClanKeys = ["objectId", "founder_id", "title", "className", "__type"];
        var ret = [];
        _.each(allNews, function(newsItem){
            var clan = newsItem.get('clanId');
            var category = newsItem.get('clanCateId');
            newsItem = newsItem._toFullJSON();
            newsItem.clanId = clan && _.pick(clan._toFullJSON(), pickClanKeys);
            newsItem.clanCateId = category && category._toFullJSON();
            ret.push({
                news:newsItem,
                extra:{
                    tagNames:common.tagNameFromId(newsItem.tags),
                    isLike:likeObj[newsItem.objectId]?true:false,
                    like:likeObj[newsItem.objectId]?newsItem:undefined
                }
            });
        });

        res.success(ret);
    }, function(err){
        console.error(err);
    });
});
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
    var newsClass = common.extendClass('News');
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
    queryNews.equalTo('status', 1);     //只显示上线的内容
    queryNews.notEqualTo('from', 1);      //只显示系统爬取的内容
    queryNews.descending('rank');
    queryNews.addDescending('publicAt');
    if (favoriteIds.length > 0) {
        queryNews.containedIn('objectId', favoriteIds);
    }

    queryNews.find().then(function(results){
        return common.newsResultWapper(userId, results);
    }).then(function(results) {
        res.success(results);
    });

    /*
    var newsIds = [];
    queryNews.find().then(function(results) {
        newsResults = results;
        for (var i in results) {
            newsIds.push(results[i].id);

            //tags列表最多返回3个，否则前端会显示不下
            var tags = results[i].get('tags');
            if (tags && tags.length>3) {
                tags.splice(3, tags.length-3);
                results[i].set('tags', tags);
            }

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
            var likeClass = common.extendClass("Like");
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
    */
});

