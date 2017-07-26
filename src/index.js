const postcss = require( 'postcss' )

const affectedProps = require( './affected-props' )
const { validateOptions } = require( './options' )
const {
    isKeyframeRule,
    isKeyframeAlreadyProcessed,
    isKeyframeSymmetric,
    rtlifyKeyframe
} = require( './keyframes' )
const { getDirRule, processSrcRule } = require( './rules' )
const { rtlifyDecl, ltrifyDecl } = require( './decls' )
const { isSelectorHasDir } = require( './selectors' )

function isIgnoreStart( comment ) {
    return comment && /rtl\:ignore\-start/.test( comment.text )
}

function isIgnoreEnd( comment ) {
    return comment && /rtl\:ignore\-end/.test( comment.text )
}

function processAtRule( rule, keyframes ) {
    if ( !isKeyframeRule( rule ) ) return
    if ( isKeyframeAlreadyProcessed( rule ) ) return
    if ( isKeyframeSymmetric( rule ) ) return

    keyframes.push( rule.params )
    rtlifyKeyframe( rule )
}

function processRule( rule, keyframes, options, ignoreRule = false ) {
    let ltrDecls = []
    let rtlDecls = []
    let dirDecls = []

    if ( !ignoreRule ) {
        if ( isSelectorHasDir( rule.selector, options ) ) return
        if ( isKeyframeRule( rule.parent ) ) return

        rule.walkDecls( decl => {
            const rtl = rtlifyDecl( decl, keyframes )

            if ( rtl ) {
                ltrDecls.push( ltrifyDecl( decl, keyframes ) )
                rtlDecls.push( decl.clone( rtl ) )
                return
            }

            if ( affectedProps.indexOf( decl.prop ) >= 0 ) {
                dirDecls.push( decl )
                decl.remove( )
            }
        } )

        if ( rtlDecls.length ) {
            let ltrDirRule
            getDirRule( rule, 'rtl', options ).append( rtlDecls )
            ltrDirRule = getDirRule( rule, 'ltr', options )
            ltrDecls.forEach( _decl => _decl.moveTo( ltrDirRule ) )
        }

        if ( dirDecls.length ) {
            getDirRule( rule, 'dir', options ).append( dirDecls )
        }

        /* set dir attrs */
        processSrcRule( rule, options )
    }
}

module.exports = postcss.plugin( 'postcss-rtl', options => css => {
    let keyframes = []
    let ignoreRule = false

    options = validateOptions( options )

    css.walk( node => {
        if ( node.type === 'atrule' ) {
            // collect @keyframes
            processAtRule( node, keyframes )
        } else if ( node.type === 'rule' ) {
            processRule( node, keyframes, options, ignoreRule )
        } else if ( node.type === 'comment' ) {
            if ( isIgnoreStart( node ) ) {
                ignoreRule = true
            } else if ( isIgnoreEnd( node ) ) {
                ignoreRule = false
            }
        }
    } )

    return false
} )
