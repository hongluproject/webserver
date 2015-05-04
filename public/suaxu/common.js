	/*常用函数*/

	//返回函数
	var timer;
	function pageBack(){
		clearTimeout(timer);
		timer=setTimeout(function(){
			history.back();
		},200);
	}

	//转换后台传送的日期
	function dateChange(val,flag){
		if(isNaN(val)){return "";}
		if(flag){
			return new Date(val*1000).format("yyyy-mm-dd hh:MM");
		}else{
			return new Date(val*1000).format("yyyy-mm-dd");
		}

	}

	//验证不通过，错误提示
	function showError(msg,time){
		time = time ? time : 2000;
		var wrap=$(".error");
		wrap[0].timer&&clearTimeout(wrap[0].timer);
		wrap.find("span").html(msg);
		wrap.show();
		wrap[0].timer=setTimeout(function(){
			wrap.animate({"opacity":"0"},"normal","",function(){
			   wrap.hide();
			   wrap.css("opacity","1");
			});
		},time);
	}

	//获取URL字段方法
	function getParam(name){
		var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)"),
			result = location.search.substring(1).match(reg);
		return result && result[2];
	}

	// 设置对应区域表单的值
	function setAreaParam(area, data, setEmpty){   //setEmpty可选，设置true 把data里面没有但area有的字段置空
		  area = $(area);
		  var ele = area.find('input,select,textarea');
		  ele.each(function(){
			  var self = $(this), attr = self.attr('type'),name = self.attr('name');
			  if(name){
				  if(setEmpty){
					 if(self.is('input') && (attr == 'checkbox' || attr == 'radio')){
						  var value = self.val();
						   if(data[name] === undefined){
								self.removeAttr("checked");
						   }else{
								(data[name] == value) && self.attr("checked","checked");
						   }
					  }else{
						 if(data[name] === undefined){
							 self.val('');
						 }else{
							self.val(data[name]);
						 }
					  }
				  }else if(data[name]){
					  if(self.is('input') && (attr == 'checkbox' || attr == 'radio')){
						  var value = self.val();
						   value && value == data[name] && self.attr("checked","checked");
					  }else{
						 self.val(data[name]);
					  }
				  }
			  }
		  });
	}
	// 获取对应区域表单的值
	function getAreaParam(area){
		  area = $(area);
		  var ele = area.find('input,select,textarea'),
			  param = {};
		  ele.each(function(){
			  var self = $(this), attr = self.attr('type'),name = self.attr('name');
			  if(name){
				  if(self.is('input') && (attr == 'checkbox' || attr == 'radio')){
					  var value = $('input[name="'+name+'"]:checked').val();
					  param[name] === undefined && value && (param[name] = value);
				  }else{
					 //if($.trim(self.val()) != ''){
						param[name] = $.trim(self.val());
					 //}

				  }
			  }
		  });
		  return param;
	}

	//设置cookies
	function SetCookie(name,value)//两个参数，一个是cookie的名子，一个是值
	{
		var Days = 30; //此 cookie 将被保存 30 天
		var exp = new Date(); //new Date("December 31, 9998");
		exp.setTime(exp.getTime() + Days*24*60*60*1000);
		document.cookie = name + "="+ escape (value) + ";expires=" + exp.toGMTString();
	}

	//获取cookies
	function getCookie(name){
		var reg = new RegExp("(^|(;\\s))"+name+"=([^;]*)"), val = '';
		var matchCookie = document.cookie.match(reg);
		if(matchCookie && matchCookie.length >= 2){
			val =  matchCookie[3];
		}
		return val;
	}

	function getClientData(name){
		var val = '';
		if(window.localStorage){
			val = localStorage[name];
		}else{
			var reg = new RegExp("(^|(;\\s))"+name+"=([^;]*)");
			var matchCookie = document.cookie.match(reg);
			if(matchCookie && matchCookie.length >= 2){
			   val =  matchCookie[3];
			}
		}
		return val;
	}

	function setClientData(name, value){
		if(window.localStorage){
			localStorage[name] = value;
		}else{
			var now = new Date();
			now = now.setDate(now.getDate() + 1);
			document.cookie = name + '=' + value + ';expires=' + new Date(now).toGMTString();
		}
	}

	function delClientData(name){
		if(window.localStorage){
			localStorage.removeItem(name);
		}else{
			var now = new Date();
			now = now.setDate(now.getDate() - 1);
			document.cookie = name + '=' + getClientData(name) + ';expires=' + new Date(now).toGMTString();
		}
	}

	function shortMsg(msg, pos, fn){
		  var wrap = $('#shortMsgBox');
		  if(wrap.length < 1){
			wrap = $('<div id="shortMsgBox" style="font-size:24px;font-weight:bold; padding:12px 18px; color:red; position:absolute;z-index:10000;">'+msg+'</div>').appendTo($('body'));
		  }else{
			  wrap.css({'display':'block','opacity' : '1'});
			  wrap.html(msg);
		  }
		  var left = pos == undefined || pos.left == undefined ? ($(window).width() - wrap.width())/2 + $(window).scrollLeft() : pos.left,
			  top = pos == undefined || pos.top == undefined ? ($(window).height() - wrap.height())/2 + $(window).scrollTop() : pos.top;
		  wrap.css({'left' : left, 'top' : top});
		  setTimeout(function(){
			wrap.animate({'opacity' : '0'},1000,function(){
				$(this).hide();
				if(fn && typeof fn == 'function'){
					fn();
				}
			});
		  },200);
	}

	//ajax请求失败，返回接口
	function ajaxErrorFn(XMLHttpRequest, textStatus, errorThrown){
		//location.href="/";
		if(textStatus=="error"){
		  $.dialog({
			title:"系统提示",
			content:"由于网络异常，请刷新页面！",
			ok:function(){
				location.reload();
			},
			okVal:"刷新",
			lock:true,
			fixed:true,
			icon:'error',
			opacity: 0.5,
			background:'#222222'
		 });
	   }
	}

	$.fn.loadMask = function(opts){
		var options = {
			wrap : $(this),
			opacity : .35,
			loadText : '<img src="/admin/images/loading.gif" width="40" height="40" />',
			bgColor : '#D2D2D2'
		};
		var o = $.extend(options, opts),
			_this = $(this)[0];
		_this.mask = $('<div class="loadmaskicon"><div class="maskBg"></div><div class="maskContent"></div></div>').appendTo($('body'));
		_this.mask.css({
			width : o.wrap.width(),
			height : o.wrap.height(),
			position : 'absolute',
			left : $(this).offset().left,
			top : $(this).offset().top,
			zIndex:100000
		}).find('.maskBg').css({
			opacity : o.opacity,
			backgroundColor : o.bgColor,
			width : "100%",
			height : "100%",
			position : 'absolute',
			left : 0,
			top : 0
		}).parent().find('.maskContent').css({
			position : 'absolute',
			left : 0,
			top : '50%',
			width : "100%",
			textAlign : 'center',
			lineHeight : o.wrap.height() + 'px'
		}).html(o.loadText);
		_this.hideMask = function(){
			_this.mask.remove();
		};
		return _this;
	};

	hideMasks = function(){
		for(var i=0;i<$(".loadmaskicon").length;i++){
			$($(".loadmaskicon")[i]).remove();
		}
	}


	//form表单事件捆发器
	function eventGatherFn(url){
		//侦听键盘"回车“事件
		$(document).keydown(function(event){
			if(event.keyCode==13){
				/*var result=getAreaParam($("#searchForm")),arr=[];
				for(var q in result){
					arr.push({"name":q,"value":result[q]});
				}
				$("#grid").flexOptions({url:url,params:arr}).flexReload();*/
				$("#searchBtn").trigger("click");
				return false;
			}
		});
		//侦听"重置按钮"点击事件
		$("#resetBtn").bind("click",function(){
			var result=getAreaParam($("#searchForm")),arr=[];
			for(var q in result){
				arr.push({"name":q,"value":""});
			}
			$("#grid").flexOptions({url:url,params:arr}).flexReload();
		});
		//侦听"搜索按钮"点击事件
		$("#searchBtn").bind("click",function(){
			var result=getAreaParam($("#searchForm")),arr=[];
			for(var q in result){
				arr.push({"name":q,"value":result[q]});
			}
			
			$("#grid").flexOptions({url:url,params:arr}).flexReload();
		});
	}

	//页面访问统计入库
	function pageLinkStatisticsFn(linkData){
		//统计
		$.ajax({
			type: "POST",
			url: "/api/linkin",
			dataType: "json",
			contentType: "application/json",
			data: JSON.stringify(linkData),
			success: function(data) {
			}
		});
	}

	//证件类型是身份证时，绑定生日和性别的值
	function bindPersonSeriesFn(attr,page){
		$("#"+attr[0]).bind("keyup",setVl);
		$("#"+attr[1]).bind("change",setVl);
		function setVl(){
			var val=$("#"+attr[0]).val(),sex;
			if(val.length>13){
				if($("#"+attr[1]).val()=="IDcard"&&checkIdcard(val)=="ok"){
					$("#"+attr[2]).val(val.substr(6,4)+"-"+val.substr(10,2)+"-"+val.substr(12,2));
					sex=parseInt(val.substr(16,1),10)%2==0?"0":"1";
					if(attr[3]){
						$("#"+attr[3]).val(sex);
					}
				}
			}
		}
	}

	//延迟加载图片，id为图片所在的区域id
	function delyShowImg(id){

		$.belowthefold = function (element) {
		    var fold = $(window).height() + $(window).scrollTop();
		    return fold <= $(element).offset().top;
		};
		$.abovethetop = function (element) {
		    var top = $(window).scrollTop();
		    return top >= $(element).offset().top + $(element).height();
		};
		/*
		*判断元素是否出现在viewport中 依赖于上两个扩展方法
		*/
		$.inViewport = function (element) {
		    return !$.belowthefold(element) && !$.abovethetop(element)
		};

		$(document).on("scroll",function(){
			var imgarr = $("#"+id+" img");
			imgarr.each(function (i) {
		        var imga = imgarr.eq(i);
		        if ($.inViewport(imga)) {
		            imga.attr("src",imga.attr('laysrc'));
		        }
		        
		    });
		});
	}

	//替换loading图片和处理内容页的图片
	function checkshowimg(id){
		var imgs = $("#"+id+" img");
			imgs.each(function (i) {
		        var imgas = imgs.eq(i);
		        if ($(imgas).offset().top<=$(window).height()) {
		            imgas.attr("src",imgas.attr('laysrc'));
		        }
		        var img = new Image();
		        img.src =imgas.attr("laysrc") ;
		        var imgWidth = img.width; //图片实际宽度		        
		        if(imgWidth >= $("#"+id).width() || imgWidth<=0){
		        	imgas.attr("width","100%");
		        	imgas.css("width","100%");
		        }else{
		        	imgas.attr("width","auto");
		        	imgas.css("width","auto");
		        }
		    });
	}

	//IE处理placeholder兼容
    	function ie_placehodler(id)
    	{

			$("#"+id).focus(function(){
				if($(this).val()==$(this).attr("_placeholder")){

					$(this).val("");
					$(this).css({"color":"#000"});
				}else{
					$(this).css({"color":"#000"});
				}
			});
			$("#"+id).focusout(function(){
				if(!$(this).val()){
					 $(this).val($("#"+id).attr("_placeholder"));
					 $(this).css({"color":"#CDCDCD"});
				}else{
					if($(this).val()==$("#"+id).attr("_placeholder")){
						$(this).css({"color":"#CDCDCD"});
					}else{
						$(this).css({"color":"#000"});
					}
					
				}
			});
			 if($("#"+id).val() && $("#"+id).val()!=$("#"+id).attr("_placeholder")){
				$("#"+id).css({"color":"#000"});
			}else{
				$("#"+id).val($("#"+id).attr("_placeholder"));
	        	$("#"+id).css({"color":"#CDCDCD"});
			}
    	}
    	
    	//
    	function check_url(str) {   		
    		var RegUrl = new RegExp();    		
    		RegUrl.compile("^[A-Za-z]+://[A-Za-z0-9-_]+\\.[A-Za-z0-9-_%&\?\/.=]+$");//jihua.cnblogs.com    		
    		if (RegUrl.test(str)) {   		
    			return true;    		
    		}   		
    		return false;    		
    	} 