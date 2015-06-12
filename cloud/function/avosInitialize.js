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
    globalObj.hpGlobal = globalObj.hpGlobal || {};

    var promises = [];
    //拉取所有的标签列表
    var queryTags = new AV.Query('Tag');
    queryTags.limit(1000);
    promises.push(queryTags.find());

    //拉取所有区域
    var queryAreas = new AV.Query('Area');
    queryAreas.limit(1000);
    promises.push(queryAreas.find());

    //拉取所有Cate
    var queryCate = new AV.Query('Cate');
    queryCate.limit(1000);
    promises.push(queryCate.find());

    //拉取所有等级信息
    var queryLevel = new AV.Query('UserGrown');
    queryLevel.limit(1000);
    promises.push(queryLevel.find());

    //拉取默认部落分类
    var queryCategory = new AV.Query('ClanCategory');
    queryCategory.equalTo('status', 1);
    queryCategory.descending('rank');
    promises.push(queryCategory.find());

    //获取全局参数
    var queryGlobal = new AV.Query('GlobalParam');
    queryGlobal.equalTo('status', 0);
    promises.push(queryGlobal.first());

    AV.Promise.when(promises).then(function(tagResults, areaResults, cateResults, levelResults,
                                            results, globalResult){
        globalObj.hpTags = {};
        for (var i in tagResults) {
            var tagItem = tagResults[i];
            globalObj.hpTags[tagItem.id] = tagItem;
        }
        console.info('get tags ok,tags count:%d', tagResults?tagResults.length:0);

        globalObj.hpAreas = {};
        for (var i in areaResults) {
            var areaItem = areaResults[i];
            globalObj.hpAreas[areaItem.id] = areaItem;
        }
        console.info('get area ok,area count:%d', areaResults?areaResults.length:0);

        globalObj.hpCates = {};
        for (var i in cateResults) {
            var cateItem = cateResults[i];
            globalObj.hpCates[cateItem.id] = cateItem;
        }
        console.info('get cate ok,cate count:%d', cateResults?cateResults.length:0);

        globalObj.hpLevels = {};
        for (var i in levelResults) {
            var levelItem = levelResults[i];
            var level = levelItem.get('level');
            globalObj.hpLevels[level] = levelItem;
        }
        console.info('get level ok,level count:%d', levelResults?levelResults.length:0);

        globalObj.hpClanCategory = [];
        _.each(results, function(category){
            globalObj.hpClanCategory.push(category);
        });
        console.info('get clanCategory ok, count:%d', results&&results.length);

        globalObj.hpGlobal = globalResult&&globalResult.get('param');
        console.info('get global param ', globalObj.hpGlobal);

        //获取登协报名用户
        AV.Cloud.httpRequest({
            method: 'GET',
            url: 'http://sport.hoopeng.cn/api/sport/userinfo?format=2'
        }).then(function(res){
            if (res.status == 200) {
                var userVal = JSON.parse(res.text);
                if (userVal) {
                    globalObj.hpCityUsers = _.values(userVal);
                    console.info('get city users count:%d', globalObj.hpCityUsers&&globalObj.hpCityUsers.length);
                }
            }
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

/*
    查询升级信息，APP每次启动的时候调用。
    函数名:
        checkUpdate
    @params:
        clientVersion:client Version
        deviceType: ios or android
        deviceVersion: 8.1.2
        manualCheck: bool 手动检测升级 (for android)
    @return:
    {
        needUpdate:true or false,
        updateType: 0 提示升级
                    1 强制升级
        message:升级提示
        clickURL:点击链接
        lastVersion:1.0.1 最近版本
        showManualUpdate: true or false ,APP默认为false,显示手动升级，IOS使用。
        launchOpt:{
            show:bool           是否显示启动图
            showSeconds:Integer 显示秒数
            picUrl:string       启动图URL
        }
    }
 */
AV.Cloud.define('checkUpdate', function(req, res) {
    var clientVersion = req.params.clientVersion;
    var deviceType = req.params.deviceType;
    var deviceVersion = req.params.deviceVersion;
    var customer = req.params.customer;
    var manualCheck = req.params.manualCheck || false;

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
            latestVersion:'1.1.4',
            needUpdate:true
        },
        iPhone:{
            latestVersion:'1.0.6',
            needUpdate:false
        }
    };

    var launchOpt = {
        show:false,
        showSeconds:5,
        picUrl:'http://hoopeng.qiniudn.com/tags/201506091636287815.jpg'
    };
    if (deviceType == 'android') {
        res.success({
            needUpdate:updateInfo.android.needUpdate &&
                        (compareVersion(updateInfo.android.latestVersion, clientVersion)>0),
            showAdForIdfa:true,
            updateType:1,
            message:'撒哈拉和上海市登山运动协会达成战略合作关系，撒哈拉将作为2015上海坐标-城市定向挑战赛官方合作平台。 \n' +
            '- 新增“部落看吧”：这里可供趣友自主填充更专业的相关内容，共同探讨和提升兴趣，支持把网页内容一键转移到自己的看吧里 \n' +
            '- 提升用户体验，修复已知问题',
            clickURL:'http://www.imsahala.com/sahala_1.1.4.apk',
            lastVersion:updateInfo.android.latestVersion,
            packageMd5:'5b1130fa46f530f0f046e3cc87d56f99',
            fileSize:13060907,
            launchOpt:launchOpt
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
            lastVersion:updateInfo.iPhone.latestVersion,
            launchOpt:launchOpt
        });
    }


})