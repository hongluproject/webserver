/**
 * Created by fugang on 14/12/13.
 */
var _ = AV._;

exports.initializeAvosData = function() {
        AV.HPGlobalParam = AV.HPGlobalParam || {};
        var globalObj = AV.HPGlobalParam;
        globalObj.hpTags = globalObj.hpTags || {};
        globalObj.hpAreas = globalObj.hpAreas || {};
        globalObj.hpCates = globalObj.hpCates || {};
        globalObj.hpLevels = globalObj.hpLevels || {};

        //拉取所有的标签列表
        var queryTags = new AV.Query('Tag');
        queryTags.limit(1000);
        queryTags.find().then(function(tagResults) {
            globalObj.hpTags = {};
            for (var i in tagResults) {
                var tagItem = tagResults[i];
                globalObj.hpTags[tagItem.id] = tagItem;
            }

            console.info('get tags ok,tags count:%d', tagResults?tagResults.length:0);

            //拉取所有区域
            var queryAreas = new AV.Query('Area');
            queryAreas.limit(1000);
            return queryAreas.find();
        }).then(function(areaResults) {
            globalObj.hpAreas = {};
            for (var i in areaResults) {
                var areaItem = areaResults[i];
                globalObj.hpAreas[areaItem.id] = areaItem;
            }

            console.info('get area ok,area count:%d', areaResults?areaResults.length:0);

            //拉取所有Cate
            var queryCate = new AV.Query('Cate');
            queryCate.limit(1000);
            return queryCate.find();
        }).then(function(cateResults) {
            globalObj.hpCates = {};
            for (var i in cateResults) {
                var cateItem = cateResults[i];
                globalObj.hpCates[cateItem.id] = cateItem;
            }
            console.info('get cate ok,cate count:%d', cateResults?cateResults.length:0);

            //拉取所有等级信息
            var queryLevel = new AV.Query('UserGrown');
            queryLevel.limit(1000);
            return queryLevel.find();
        }).then(function(levelResults){
            globalObj.hpLevels = {};
            for (var i in levelResults) {
                var levelItem = levelResults[i];
                var level = levelItem.get('level');
                globalObj.hpLevels[level] = levelItem;
            }

            console.info('get level ok,level count:%d', levelResults?levelResults.length:0);
            //拉取默认部落分类
            var queryCategory = new AV.Query('ClanCategory');
            queryCategory.equalTo('status', 1);
            queryCategory.descending('rank');
            return queryCategory.find();
        }).then(function(results){
            console.info('get clanCategory ok, count:%d', results&&results.length);
            globalObj.hpClanCategory = [];
            _.each(results, function(category){
                globalObj.hpClanCategory.push(category);
            });
        });

}

/** 定时更新呼朋数据，在avos平台设置调用，每隔1小时更新一次
 *
 */
AV.Cloud.define('updateHPParamTimer', function(req, res) {
    exports.initializeAvosData();
    res.success();
});

/*  查询升级信息，APP每次启动的时候调用。
    @params:
        clientVersion:client Version
        deviceType: ios or android
        deviceVersion: 8.1.2
    @return:
    {
        needUpdate:true or false,
        updateType: 0 提示升级
                    1 强制升级
        message:升级提示
        clickURL:点击链接
        lastVersion:1.0.1 最近版本
        showManualUpdate: true or false ,APP默认为false,显示手动升级，IOS使用。
    }
 */
AV.Cloud.define('checkUpdate', function(req, res) {
    var clientVersion = req.params.clientVersion;
    var deviceType = req.params.deviceType;
    var deviceVersion = req.params.deviceVersion;
    var customer = req.params.customer;

    //compare version1 and version,
    //  if version2>version1 return 1
    //  if version2==version1 return 0
    //  if version2<version1 return -1
    function compareVersion(version1, version2) {
        var arr1 = version1.split('.') || [];
        var arr2 = version2.split('.') || [];

        if (arr1.length > arr2.length) {
            return 1;
        } else if (arr1.length < arr2.length) {
            return -1;
        } else {
            for (var i in arr1) {
                var intVal1 = parseInt(arr1[i]);
                var intVal2 = parseInt(arr2[i]);
                if (intVal1 > intVal2) {
                    return 1;
                } else if (intVal1 < intVal2) {
                    return -1;
                }
            }
            return 0;
        }
        return 0;
    }

    console.info('checkUpdate params, clientVersion:%s deviceType:%s deviceVersion:%s customer:%s',
        clientVersion, deviceType, deviceVersion, customer);

    var updateInfo = {
        android:{
            latestVersion:'1.0.9',
            needUpdate:true
        },
        iPhone:{
            latestVersion:'1.0.6',
            needUpdate:false
        }
    };

    if (deviceType == 'android') {
        res.success({
            needUpdate:updateInfo.android.needUpdate &&
                        (compareVersion(updateInfo.android.latestVersion, clientVersion)>0),
            showAdForIdfa:true,
            updateType:1,
            message:'1.兴趣部落全面改版 \n2.更多同趣伙伴和部落推荐，找朋友、找圈子更容易 \n3.优化一些细节体验',
            clickURL:'http://imsahala.com/sahala_1.0.9_20150506_126_0.apk',
            lastVersion:updateInfo.android.latestVersion,
            packageMd5:'89a24462c0def11d791d09410bdd8a5c'
        });
    } else {
        res.success({
            needUpdate:false,
            showAdForIdfa:true,
            showManualUpdate:false, //显示手动升级，APP默认为false，若showManualUpdate为true，则显示
            updateType:1,
            message:'1、第一次发布版本\n' +
            '2、天天向上\n' +
            '3、我是歌手\n' +
            '4、奔跑吧兄弟\n' +
            '5、最强大脑',
            clickURL:'https://itunes.apple.com/us/app/sa-ha-la-jie-shi-tong-qu-peng/id952260502?mt=8&uo=4',
            lastVersion:updateInfo.iPhone.latestVersion
        });
    }


})