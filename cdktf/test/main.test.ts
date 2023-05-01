import 'cdktf/lib/testing/adapters/jest' // Load types for expect matchers
import { Testing } from 'cdktf'
import { EfsFileSystem } from '@cdktf/provider-aws/lib/efs-file-system'
import { GithubRunners } from '../src/githubRunners'

describe('Shakr Platform', () => {
    describe('assert github runners', () => {
        it('should contain a resource', () => {
            const result = Testing.synthScope((scope) => {
                new GithubRunners(scope, 'my-app', {
                    region: 'ap-northeast-1'
                })
            })
            expect(result).toHaveResource(EfsFileSystem)
        })
    })
})
