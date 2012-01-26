/**
    MyImgScale v0.2
 
    MyImgScale is a jQuery plugin to scale images to fit or fill their parent container.
    Note: The parent container of the image must have a defined height and width in CSS.
    
    It is actually a merger/improvement from two existing plugins:
     1) Image Scale v1.0 by Kelly Meath (http://imgscale.kjmeath.com/), and
     2) CJ Object Scaler v3.0.0 by Doug Jones (http://www.cjboco.com/projects.cfm/project/cj-object-scaler/)

    The reasons for this merger are:
    . CJ Object Scaler has a conciser image resizing algorithm while Image Scale has a clearer layout.
    . CJ Object Scaler has an overflow issue, ie. the image scaled is not confined in parent container.
    . Both have the wrong calculation when parent container is invisible.
    
    If the parent container has padding, the scaled image might still cross boundary.
    One of the solutions is to insert a wrapper div with the same height and width as the parent container, eg:
    <div id="parent" style="height: 120px; width: 90px; padding: 10px">
      <div id="interimWrapper" style="height: 120px; width: 90px;">
        <img src="<Your img link here>" />
      </div>
    </div>
    I prefer to do this in application rather than in plugin as it is somewhat obtrusive.
    
    Web: https://bitbucket.org/marshalking/myimgscale
    Updated: Apr 15, 2011 by Marshal
    
    -----------------------------------------------------------------------
    MIT License

    Copyright (c) 2011 Doug Jones, Kelly Meath, Marshal

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

;(function ( $, window, document, undefined ) {
    var pluginName = 'fitImage',
        defaults = {
        	parent: false,
        	scaleMode: 'outside',  // none | stretch | inside | outside 
        	noHiddenOverflow: false,   
        	fade: 0,
        	animate: 0,
        	animateEase: 'swing',
        	protect: 0,
        	doNotUpdateWhenHidden: true /* don't update when the viewport's element is hidden for resize events */
        };

    function Plugin( element, options ) {
		this.element = element;
		this.$element = $(element);

        this.options = $.extend( {}, defaults, options, $(element).data()) ;

		this.$parent = this.options.parent ? this.$element.parents(this.options.parent) : this.$element.parent();
        
        this._defaults = defaults;
        this._name = pluginName;

        this.init();
    }


    Plugin.prototype.init = function () {
		var self = this;

		self.intrinsicWidth = undefined;
        self.intrinsicHeight = undefined;
		self.aspectRatio = undefined;
		self.rnd = Math.random();

		if (self.options.protect) {
            self.$element.bind("contextmenu mousedown", function (event) {
				return false;
            });
        }

    	$(window).bind('resize', function (event) {
          	self.update();
        });
        
        // http://msdn.microsoft.com/en-us/library/ms530822(v=vs.85).aspx
        if ($.browser.msie && parseInt($.browser.version.slice(0, 3)) >= 7 && parseInt($.browser.version.slice(0, 3)) <= 8) {
            this.$element.css('-ms-interpolation-mode', 'bicubic'); // or nearest-neighbor
        }
                
		// https://developer.mozilla.org/En/CSS/Image-rendering
        if ($.browser.mozilla && $.browser.version.slice(0, 3) == '1.9') {
			this.$element.css('image-rendering', 'optimizeQuality');  /* Firefox 3.6+; default behavior is identical, no need to specify */
		}

        if (this.$parent.length > 0) {
        
        	var css = {};
        	css.opacity = 0;
        	if (!this.options.noHiddenOverflow)
        		css.overflow = 'hidden';
        	this.$parent.css(css);

            this.$element.removeAttr('height').removeAttr('width');

            if (this.element.complete)
            	this._imageLoadedHandler();

			this.$element.bind('load', function() {
				self._imageLoadedHandler();
			});
            
        }
    };

    Plugin.prototype.update = function (initializing) {
    	var viewportSize = {width: this.$parent.width(), height: this.$parent.height()};
        if (viewportSize.width === 0 || viewportSize.height === 0) { // parent is invisible, eg. display: none
        	if (this.options.doNotUpdateWhenHidden)
        		return;

            viewportSize = this._getElementSizeWhenHidden(this.$parent);
        }
    	
    	this._centerImageWithinParent(viewportSize);
    	
    	switch (this.options.scaleMode) {
                case 'outside':
                    var scale = Math.min(this.intrinsicWidth / viewportSize.width, this.intrinsicHeight / viewportSize.height);
                    var newWidth = Math.round(this.intrinsicWidth / scale);
                    var newHeight = Math.round(this.intrinsicHeight / scale);
                    break;
                case 'inside':
                    var scale = Math.max(this.intrinsicWidth / viewportSize.width, this.intrinsicHeight / viewportSize.height);
                    var newWidth = Math.round(this.intrinsicWidth / scale);
                    var newHeight = Math.round(this.intrinsicHeight / scale);
                    break;
                case 'stretch':
                    var newWidth = viewportSize.width;
                    var newHeight = viewportSize.height;
                    break;
                case 'none':
                    var newWidth = this.intrinsicWidth;
                    var newHeight = this.intrinsicHeight;
                    break;
                }

                if (initializing || !this.options.animate) {
                    this.$element.stop().css({
                        width: newWidth,
                        height: newHeight
                    });
        
                    this._centerImageWithinParent(viewportSize);
    	
                    return;
                }

				var self = this;

                this.$element.stop().animate({
                    width: newWidth,
                    height: newHeight
                }, {
                    duration: this.options.animate,
                    easing: this.options.animateEase,
                    step: function (now, fx) {
                        self._centerImageWithinParent(viewportSize);
                    },
                    complete: function () {
                        self._centerImageWithinParent(viewportSize);
                    }
                });
    	
    };
    
    Plugin.prototype._imageLoadedHandler = function () {
    	this._determainIntrinsicSizes();
    	
    	this.update(true);
    	
		(this.options.fade > 0) ? this.$parent.animate({'opacity': '1'}, this.options.fade) : this.$parent.css('opacity', '1');
    };
    
    Plugin.prototype._centerImageWithinParent = function(viewportSize) {
		this.$element.css({
			marginLeft: Math.ceil((viewportSize.width - this.$element.width()) / 2),
			marginTop: Math.ceil((viewportSize.height - this.$element.height()) / 2)
		});
	}
    /**
     * To calculate the correct scale ratio, we need the image's original size rather than some preset values,
     * which were set either manually in code or automatically by browser.
     * Thanks FDisk for the solution:
     * http://stackoverflow.com/questions/318630/get-real-image-width-and-height-with-javascript-in-safari-chrome
     */
    Plugin.prototype._determainIntrinsicSizes = function(img) {
    	var t = new Image();
        t.src = this.$element.attr("src");
        
        this.intrinsicWidth = t.width;
        this.intrinsicHeight = t.height;
		this.aspectRatio = t.width / t.height;
    };

    /**
     * If the element is invisible, jQuery .height() and .width() return 0.
     * This function returns the hidden element's correct width and height.
     * Thanks elliotlarson for the solution:
     * http://stackoverflow.com/questions/2345784/jquery-get-height-of-hidden-element-in-jquery-1-4-2
     *
     * ADD THIS CSS RULE
     * used for exposing elements  
     * since this is a temporary class we can override using important
  	 * .fitimage-tmp-show {position:absolute !important; visibility:hidden !important; display:block !important;}
     *
     */
    Plugin.prototype._getElementSizeWhenHidden = function(element) {
    	// find the closest visible parent and get it's hidden children
    	var visibleParent = element.parents().filter(':not(:visible)'), size;

		// set a temporary class on the hidden parent of the element
    	visibleParent.addClass('fitimage-tmp-show');
    
    	// get dimensions
    	size = {width: element.width(), height: element.height()};

    	// remove the temporary class
    	visibleParent.removeClass('fitimage-tmp-show');

    	return size;
    };

    $.fn[pluginName] = function ( ) {
    	var args = arguments;
    	
    	return this.each(function () {
    		var pluginInstance = $(this).data('plugin_' + pluginName);
    		
    		if (!pluginInstance) {
                $(this).data('plugin_' + pluginName, new Plugin( this, args[0] ));
                
                return;
            }
            
            if (args.length == 0)
            	args[0] = 'update';

            if (args[0].substring(0,1) != '_' && typeof pluginInstance[args[0]] == 'function') {
            	pluginInstance.update();
    	        //return pluginInstance[args[0]].apply(pluginInstance, Array.prototype.slice.call(args, 1));
			} else {
	            $.error( 'Method "' + args[0] + '" does not exist in plugin "'+pluginName+'"!');
	        }
        });
    }

})( jQuery, window, document );