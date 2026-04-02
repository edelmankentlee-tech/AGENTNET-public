"""
AgentNet SDK - Python
AgentNet Protocol V3 官方 Python SDK
"""

from setuptools import setup, find_packages

with open('README.md', 'r', encoding='utf-8') as f:
    long_description = f.read()

setup(
    name='agentnet-sdk',
    version='1.0.0',
    description='AgentNet Protocol V3 官方 Python SDK',
    long_description=long_description,
    long_description_content_type='text/markdown',
    author='AgentNet Protocol Core Team',
    license='MIT',
    url='https://github.com/agentnet/protocol',
    packages=find_packages(),
    package_dir={'': '.'},
    python_requires='>=3.10',
    install_requires=[
        'websockets>=12.0',
        'pydantic>=2.0',
        'httpx>=0.25.0',
    ],
    extras_require={
        'dev': [
            'pytest>=7.4.0',
            'pytest-asyncio>=0.21.0',
            'pytest-cov>=4.1.0',
            'black>=23.0.0',
            'ruff>=0.1.0',
        ]
    },
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'Topic :: Artificial Intelligence',
    ],
    keywords='agentnet agent ai protocol multi-agent',
)
